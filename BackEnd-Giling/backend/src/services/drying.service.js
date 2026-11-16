const {
    dryingProcessesModel,
    dryingBatchesModel,
    dryingSessionsModel,
    dryingPhotosModel,
    dryingLinksModel,
    batchesModel
} = require('../models');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const db = require('../config/database');
const crypto = require('crypto');
const { rateLimitService } = require('./ratelimit.service');
const { validateDryingSessionData } = require('../validators/form.validator');
const { ownershipChecks } = require('../utils/authGuards');
const { inTenant } = require('../utils/tenant');

class DryingService {
    // Generate unique link code
    generateLinkCode() {
        return crypto.randomBytes(6).toString('hex').toUpperCase();
    }

    // Admin: Create new drying process
    async createDryingProcess(command) {
        const dryingData = {
            createdBy: command.userId,
            status: 'PENDING',
            name: command.name,
            notes: command.notes,
            dryingType: command.dryingType || 'oven_mandiri',
            vendorName: command.vendorName || null,
            // Legacy titipan support (kept for backward compat, but no longer used for new creation)
            isTitipan: false,
            titipanData: null,
            titipanInventoryId: command.titipanInventoryId || null
        };

        const drying = await dryingProcessesModel.create(dryingData);

        if (command.titipanInventoryId) {
            // Gabah Basah Titipan selected — no batch linking needed; inventory item is already recorded
        } else if (command.batchIds && command.batchIds.length > 0) {
            // Add regular batches
            for (const batchId of command.batchIds) {
                const batch = await batchesModel.findById(batchId);
                if (batch) {
                    await dryingBatchesModel.create({
                        dryingId: drying.id,
                        batchId: batchId,
                        tonnageKg: batch.total_qty_kg || 0
                    });
                }
            }
        }

        return dryingProcessesModel.findById(drying.id);
    }

    async getDryingById(id, user) {
        const drying = await dryingProcessesModel.findByIdWithDetails(id, user);
        if (!drying) throw new NotFoundError('Proses pengeringan tidak ditemukan');
        return drying;
    }

    async getAllDrying(filters, limit, offset, user) {
        const drying = await dryingProcessesModel.getAll(filters, limit, offset, user);
        const total = await dryingProcessesModel.count(filters, user);
        return { dryings: drying, total };
    }

    // Admin: Delete drying process
    async deleteDrying(id) {
        await this.getDryingById(id);
        return dryingProcessesModel.delete(id);
    }

    // Admin: Get all links for a drying process
    async getLinksByDryingId(dryingId) {
        return dryingLinksModel.getByDryingId(dryingId);
    }

    // Admin: Generate/Get link for operator
    async getOrCreateLink(dryingId) {
        let link = await dryingLinksModel.getByDryingId(dryingId);
        if (!link) {
            link = await this.createLink(dryingId);
        }
        return link;
    }

    // Admin: Create new link manually
    async createLink(command) {
        return dryingLinksModel.create({
            dryingId: command.dryingId,
            linkCode: this.generateLinkCode(),
            expiresAt: command.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });
    }

    // Admin: Update drying batches
    async updateDryingBatches(command) {
        await dryingBatchesModel.deleteByDryingId(command.dryingId);
        
        if (command.batchIds && command.batchIds.length > 0) {
            for (const batchId of command.batchIds) {
                const batch = await batchesModel.findById(batchId);
                if (batch) {
                    await dryingBatchesModel.create({
                        dryingId: command.dryingId,
                        batchId,
                        tonnageKg: batch.total_qty_kg || 0
                    });
                }
            }
        }
        
        return this.getDryingById(command.dryingId);
    }

    // Admin: Toggle drying active status
    async toggleDryingActive(command) {
        return dryingProcessesModel.update(command.id, { is_active: command.isActive });
    }

    // Admin: Toggle link active status (using expires_at)
    async toggleLinkActive(command) {
        // Verify the link belongs to the given drying process
        await ownershipChecks.dryingLink(command.linkId, command.dryingId, 'Link tidak ditemukan untuk pengeringan ini');
        const expiresAt = command.isActive ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date(0);
        return dryingLinksModel.update(command.linkId, { expires_at: expiresAt });
    }

    // Admin: Delete link
    async deleteLink(linkId, dryingId) {
        // Verify the link belongs to the given drying process
        await ownershipChecks.dryingLink(linkId, dryingId, 'Link tidak ditemukan untuk pengeringan ini');
        return dryingLinksModel.delete(linkId);
    }

    // Admin: Approve drying
    async approveDrying(command) {
        const drying = await this.getDryingById(command.id);
        if (drying.status !== 'PENDING_APPROVAL') {
            throw new BusinessRuleError('Hanya pengeringan dengan status PENDING_APPROVAL yang bisa diapprove');
        }

        // Update status to COMPLETED
        const result = await dryingProcessesModel.update(command.id, { status: 'COMPLETED' });

        // -------- Submit Deferred Drying Costs --------
        const financeModel = require('../models/finance.model');
        const expId = await financeModel.getRequiredAccountId('5-300');

        // Fetch all costs where financeTransactionId IS NULL
        const costsResult = await db.query(`SELECT * FROM trx.drying_costs WHERE drying_id = $1 AND finance_transaction_id IS NULL`, [command.id]);
        
        for (const c of costsResult.rows) {
            const financeTx = await financeModel.createJournalEntry({
                referenceType: 'DRYING_COST',
                referenceId: command.id,
                description: `Biaya Jemur ${drying.name}: ${c.description || c.cost_type}`,
                status: 'PENDING',
                createdBy: command.userId, // use userId passed to approveDrying
                lines: [
                    { accountId: expId, debit: Number(c.amount), credit: 0 },
                    { accountId: null, debit: 0, credit: Number(c.amount) }
                ]
            });
            await db.query(`UPDATE trx.drying_costs SET finance_transaction_id = $1 WHERE id = $2`, [financeTx.id, c.id]);
        }

        return result;
    }

    // Admin: Reject / Reset drying
    async rejectDrying(command) {
        const drying = await this.getDryingById(command.id);
        if (drying.status !== 'PENDING_APPROVAL' && drying.status !== 'IN_PROGRESS') {
            throw new BusinessRuleError('Hanya pengeringan dengan status PENDING_APPROVAL atau IN_PROGRESS yang bisa direject/reset');
        }

        // Delete existing drying sessions and photos so operator form is reset back to step 1
        await dryingSessionsModel.deleteByDryingId(command.id);
        
        // Reset the rate limit so the operator can submit again
        await rateLimitService.resetCount('drying', command.id);

        return dryingProcessesModel.update(command.id, { status: 'IN_PROGRESS' });
    }

    async getStartSessionByDryingId(dryingId) {
        return dryingSessionsModel.getByDryingIdAndType(dryingId, 'START');
    }

    async getEndSessionByDryingId(dryingId) {
        return dryingSessionsModel.getByDryingIdAndType(dryingId, 'END');
    }

    // Form: Validate link and get basic info
    async getFormInfo(linkCode) {
        const link = await dryingLinksModel.findByLinkCode(linkCode);
        if (!link) throw new NotFoundError('Link tidak valid atau kadaluarsa');
        
        const drying = await dryingProcessesModel.findByIdWithDetails(link.drying_id);
        if (!drying) throw new NotFoundError('Data pengeringan tidak ditemukan');

        return {
            dryingId: drying.id,
            name: drying.name,
            status: drying.status,
            totalTonnage: Number(drying.total_tonnage) || 0,
            batches: drying.batches,
            sessions: drying.sessions
        };
    }

    // Form: Submit start session
    async submitStartSession(command) {
        const formInfo = await this.getFormInfo(command.linkCode);

        // Rate limiting check
        await rateLimitService.enforceLimit('drying', formInfo.dryingId);

        // Validate input data
        const validatedData = validateDryingSessionData(command.data);

        // Check if already started
        const existingStart = await dryingSessionsModel.getByDryingIdAndType(formInfo.dryingId, 'START');
        if (existingStart) {
            throw new BusinessRuleError('Session mulai sudah ada');
        }

        // Increment submission count
        await rateLimitService.incrementCount('drying', formInfo.dryingId);

        // Create session
        const session = await dryingSessionsModel.create({
            dryingId: formInfo.dryingId,
            sessionType: 'START',
            pic: validatedData.pic,
            peopleInvolved: validatedData.peopleInvolved,
            sessionDate: validatedData.sessionDate,
            sessionTime: validatedData.sessionTime,
            moistureContent: validatedData.moistureContent,
            tonnageKg: validatedData.tonnageKg,
            buttonPressedAt: new Date()
        });

        // Save photos
        if (command.photos && command.photos.length > 0) {
            for (const photo of command.photos) {
                await dryingPhotosModel.create({
                    sessionId: session.id,
                    filePath: photo.path,
                    fileName: photo.originalname,
                    fileSize: photo.size
                });
            }
        }

        // Update status to IN_PROGRESS
        await dryingProcessesModel.update(formInfo.dryingId, { status: 'IN_PROGRESS' });

        // Link batch if provided
        if (command.data.batchId) {
            const batch = await batchesModel.findById(command.data.batchId);
            if (batch) {
                // Check if already linked
                const existingLinks = await dryingBatchesModel.getByDryingId(formInfo.dryingId);
                const isAlreadyLinked = existingLinks.some(link => link.batch_id === command.data.batchId);
                if (!isAlreadyLinked) {
                    await dryingBatchesModel.create({
                        dryingId: formInfo.dryingId,
                        batchId: command.data.batchId,
                        tonnageKg: batch.total_qty_kg || 0
                    });
                }
            }
        }

        return session;
    }

    // Form: Submit end session
    async submitEndSession(command) {
        const formInfo = await this.getFormInfo(command.linkCode);

        // Rate limiting check
        await rateLimitService.enforceLimit('drying', formInfo.dryingId);

        // Validate input data
        const validatedData = validateDryingSessionData(command.data);

        // Check if drying is active
        const drying = await dryingProcessesModel.findById(formInfo.dryingId);
        if (!drying.is_active) {
            throw new BusinessRuleError('Pengeringan ini tidak aktif');
        }

        // Check if start session exists
        const startSession = await dryingSessionsModel.getByDryingIdAndType(formInfo.dryingId, 'START');
        if (!startSession) {
            throw new BusinessRuleError('Harus submit session mulai terlebih dahulu');
        }

        // Validate moisture content: end moisture must be strictly lower than start moisture
        if (validatedData.moistureContent != null && validatedData.moistureContent !== '' &&
            startSession.moisture_content != null && startSession.moisture_content !== '') {
            const startMoisture = parseFloat(startSession.moisture_content);
            const endMoisture = parseFloat(validatedData.moistureContent);
            if (!isNaN(startMoisture) && !isNaN(endMoisture)) {
                if (endMoisture >= startMoisture) {
                    throw new BusinessRuleError(`Kadar air akhir (${endMoisture}%) harus lebih rendah dari kadar air awal (${startMoisture}%)`);
                }
            }
        }

        // Check if end session already exists
        const existingEnd = await dryingSessionsModel.getByDryingIdAndType(formInfo.dryingId, 'END');
        if (existingEnd) {
            throw new BusinessRuleError('Session selesai sudah ada');
        }

        // Increment submission count
        await rateLimitService.incrementCount('drying', formInfo.dryingId);

        // Create session
        const session = await dryingSessionsModel.create({
            dryingId: formInfo.dryingId,
            sessionType: 'END',
            pic: validatedData.pic,
            peopleInvolved: validatedData.peopleInvolved,
            sessionDate: validatedData.sessionDate,
            sessionTime: validatedData.sessionTime,
            moistureContent: validatedData.moistureContent,
            tonnageKg: validatedData.tonnageKg,
            wasteKg: parseFloat(command.data.wasteKg) || 0,
            wasteReason: command.data.wasteReason || null,
            buttonPressedAt: new Date()
        });

        // Save photos
        if (command.photos && command.photos.length > 0) {
            for (const photo of command.photos) {
                await dryingPhotosModel.create({
                    sessionId: session.id,
                    filePath: photo.path,
                    fileName: photo.originalname,
                    fileSize: photo.size
                });
            }
        }

        // Update status to PENDING_APPROVAL (admin must approve)
        await dryingProcessesModel.update(formInfo.dryingId, { status: 'PENDING_APPROVAL' });

        // Input Admin: only when the form was opened from the "Input Admin" button (mode=admin)
        // AND the logged-in user is the admin/owner who owns this drying, approve right away.
        // Anything submitted through a shareable link (even on a device logged in as admin)
        // stays PENDING_APPROVAL. Costs still go to Finance either way.
        const user = command.user;
        const role = String(user?.role || '').toLowerCase();
        if (command.adminMode && user && ['admin', 'owner'].includes(role) && inTenant(drying.created_by, user)) {
            await this.approveDrying({ id: formInfo.dryingId, userId: user.id });
            command.autoApproved = true;
        }

        return session;
    }

    // Form: Get summary
    async getSummary(linkCode) {
        const formInfo = await this.getFormInfo(linkCode);

        const startSession = formInfo.sessions.find(s => s.session_type === 'START');
        const endSession = formInfo.sessions.find(s => s.session_type === 'END');

        if (!startSession || !endSession) {
            throw new BusinessRuleError('Both start and end sessions required for summary');
        }

        // Helper to get YYYY-MM-DD from Date or String
        const formatDate = (d) => {
            if (d instanceof Date) return d.toISOString().split('T')[0];
            if (typeof d === 'string' && d.includes('T')) return d.split('T')[0];
            return d;
        };

        // Helper to get HH:mm from HH:mm:ss or HH:mm
        const formatTime = (t) => {
            if (typeof t === 'string') return t.slice(0, 5);
            return t;
        };

        const startDate = formatDate(startSession.session_date);
        const startTimeStr = formatTime(startSession.session_time);
        const endDate = formatDate(endSession.session_date);
        const endTimeStr = formatTime(endSession.session_time);

        const startTime = new Date(`${startDate}T${startTimeStr}`);
        const endTime = new Date(`${endDate}T${endTimeStr}`);
        const durationMs = endTime - startTime;

        const safeDurationMs = isNaN(durationMs) || durationMs < 0 ? 0 : durationMs;
        const durationHours = Math.floor(safeDurationMs / (1000 * 60 * 60));
        const durationMinutes = Math.floor((safeDurationMs % (1000 * 60 * 60)) / (1000 * 60));

        const moistureBefore = startSession.moisture_content != null && startSession.moisture_content !== '' ? parseFloat(startSession.moisture_content) : null;
        const moistureAfter = endSession.moisture_content != null && endSession.moisture_content !== '' ? parseFloat(endSession.moisture_content) : null;
        const moistureDifference = (moistureBefore != null && moistureAfter != null) ? (moistureBefore - moistureAfter).toFixed(2) : null;

        const tonnageBefore = startSession.tonnage_kg ? parseFloat(startSession.tonnage_kg) : null;
        const tonnageAfter = endSession.tonnage_kg ? parseFloat(endSession.tonnage_kg) : null;

        return {
            startPic: startSession.pic,
            endPic: endSession.pic,
            startPeopleInvolved: startSession.people_involved,
            endPeopleInvolved: endSession.people_involved,
            startSessionDate: startDate,
            startSessionTime: startTimeStr,
            endSessionDate: endDate,
            endSessionTime: endTimeStr,
            durationMs: safeDurationMs,
            duration: `${durationHours}j ${durationMinutes}m`,
            totalTonnage: formInfo.totalTonnage,
            moistureBefore,
            moistureAfter,
            moistureDifference,
            tonnageBefore,
            tonnageAfter,
            startSession,
            endSession
        };
    }

    // Drying Costs Management
    async addDryingCost(command) {
        const drying = await this.getDryingById(command.dryingId);
        const db = require('../config/database');
        const financeModel = require('../models/finance.model');
        let financeTx = null;
        if (drying.status === 'COMPLETED') {
            const expId = await financeModel.getRequiredAccountId('5-300');

            financeTx = await financeModel.createJournalEntry({
                referenceType: 'DRYING_COST',
                referenceId: command.dryingId,
                description: `Biaya Jemur ${drying.name}: ${command.costData.description || command.costData.costType}`,
                status: 'PENDING',
                createdBy: command.userId,
                lines: [
                    { accountId: expId, debit: Number(command.costData.amount), credit: 0 },
                    { accountId: null, debit: 0, credit: Number(command.costData.amount) }
                ]
            });
        }

        const result = await db.query(
            `INSERT INTO trx.drying_costs
            (drying_id, cost_type, description, amount, finance_transaction_id, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [command.dryingId, command.costData.costType, command.costData.description, command.costData.amount, financeTx ? financeTx.id : null, command.userId]
        );

        return result.rows[0];
    }

    async getDryingCosts(dryingId) {
        const db = require('../config/database');
        const result = await db.query(
            "SELECT * FROM trx.drying_costs WHERE drying_id = $1 ORDER BY created_at ASC",
            [dryingId]
        );
        return result.rows;
    }

    async deleteDryingCost(dryingId, costId) {
        const db = require('../config/database');
        
        const costResult = await db.query(
            "SELECT * FROM trx.drying_costs WHERE id = $1 AND drying_id = $2",
            [costId, dryingId]
        );
        
        if (costResult.rows.length === 0) {
            throw new Error('Biaya tidak ditemukan');
        }
        
        const cost = costResult.rows[0];
        
        await db.query("DELETE FROM trx.drying_costs WHERE id = $1", [costId]);
        
        if (cost.finance_transaction_id) {
            const txResult = await db.query(
                "SELECT * FROM trx.journal_lines WHERE journal_id = $1",
                [cost.finance_transaction_id]
            );
            const jeResult = await db.query("SELECT status FROM trx.journal_entries WHERE id = $1", [cost.finance_transaction_id]);
            
            if (jeResult.rows.length > 0 && jeResult.rows[0].status === 'APPROVED') {
                for (const line of txResult.rows) {
                    if (!line.account_id) continue;
                    const accRes = await db.query('SELECT account_category FROM trx.finance_accounts WHERE id = $1', [line.account_id]);
                    const category = accRes.rows[0]?.account_category || 'ASSET';
                    
                    let balanceChange = 0;
                    if (['ASSET', 'EXPENSE'].includes(category)) {
                        balanceChange = Number(line.credit) - Number(line.debit); // Reverse
                    } else {
                        balanceChange = Number(line.debit) - Number(line.credit);
                    }
                    if (balanceChange !== 0) {
                        await db.query("UPDATE trx.finance_accounts SET balance = balance + $1 WHERE id = $2", [balanceChange, line.account_id]);
                    }
                }
            }
            await db.query("DELETE FROM trx.journal_entries WHERE id = $1", [cost.finance_transaction_id]);
        }
        
        return true;
    }
}

module.exports = new DryingService();
