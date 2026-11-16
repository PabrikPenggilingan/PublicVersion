const {
    processesModel,
    millingLinkModel,
    millingSessionModel,
    millingPhotoModel,
    inventoryItemsModel,
    inventoryTransactionsModel
} = require('../models');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const crypto = require('crypto');

class MillingService {
    // Generate unique link code
    generateLinkCode() {
        return crypto.randomBytes(6).toString('hex').toUpperCase();
    }

    // Admin: Get or Create link for operator
    async getOrCreateLink(processId) {
        const process = await processesModel.findById(processId);
        if (!process) throw new NotFoundError('Proses giling tidak ditemukan');

        let link = await millingLinkModel.getByProcessId(processId);
        if (!link) {
            const linkCode = this.generateLinkCode();
            link = await millingLinkModel.create({
                processId,
                linkCode,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            });
            
            // Link back to process
            await processesModel.update(processId, { milling_link_id: link.id });
        }
        return link;
    }

    // Form: Validate link and get process info
    async getFormInfoByCode(linkCode) {
        const link = await millingLinkModel.getByCode(linkCode);
        if (!link) throw new NotFoundError('Link tidak valid atau kadaluarsa');

        const process = await processesModel.findByIdWithDetails(link.process_id);
        if (!process) throw new NotFoundError('Data proses tidak ditemukan');

        const sessions = await millingSessionModel.getByProcessId(link.process_id);

        return {
            processId: process.id,
            processNo: process.process_no,
            status: process.status,
            gabahReservedKg: process.gabah_reserved_kg,
            gabahName: process.gabah_area || 'Gabah',
            sessions
        };
    }

    // Form: Submit Session (START, END, PAUSE, RESUME)
    async submitSession(command) {
        const link = await millingLinkModel.getByCode(command.linkCode);
        if (!link) throw new NotFoundError('Link tidak valid');

        const { sessionType, pic, crewNames, notes, moistureContent, hardnessType, brokenRatio, outputData, photos } = command;

        // Validation based on type
        if (sessionType === 'START') {
            const existingStart = await millingSessionModel.getByProcessIdAndType(link.process_id, 'START');
            if (existingStart) throw new BusinessRuleError('Sesi mulai sudah ada');
            
            await processesModel.update(link.process_id, { status: 'IN_PROGRESS' });
        }

        // Create session
        const session = await millingSessionModel.create({
            processId: link.process_id,
            sessionType,
            pic,
            crewNames,
            notes,
            moistureContent,
            hardnessType,
            brokenRatio,
            outputData,
            sessionDate: new Date(),
            sessionTime: new Date().toLocaleTimeString('en-GB', { hour12: false })
        });

        // Save photos
        if (photos && photos.length > 0) {
            for (const photo of photos) {
                await millingPhotoModel.create({
                    sessionId: session.id,
                    filePath: photo.filePath,
                    fileName: photo.originalName,
                    fileSize: photo.sizeBytes
                });
            }
        }

        return session;
    }

    // Admin: Get Full Summary with Duration
    async getProcessSummary(processId) {
        const sessions = await millingSessionModel.getByProcessId(processId);
        if (sessions.length === 0) return null;

        const start = sessions.find(s => s.session_type === 'START');
        const end = sessions.find(s => s.session_type === 'END');

        let durationHours = 0;
        if (start && end) {
            const startTime = new Date(`${start.session_date.toISOString().split('T')[0]}T${start.session_time}`);
            const endTime = new Date(`${end.session_date.toISOString().split('T')[0]}T${end.session_time}`);
            const diffMs = endTime - startTime;
            durationHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
        }

        return {
            sessions,
            durationHours,
            startPIC: start?.pic,
            crewNames: start?.crew_names
        };
    }

    // Finalize: Admin approves and moves to inventory
    async finalizeProduction(processId, adminId, corrections = null) {
        const process = await processesModel.findByIdWithDetails(processId);
        if (process.status === 'COMPLETED') throw new BusinessRuleError('Proses sudah selesai');

        const sessions = await millingSessionModel.getByProcessId(processId);
        const endSession = sessions.find(s => s.session_type === 'END');
        if (!endSession) throw new BusinessRuleError('Laporan sesi selesai belum ada');

        let outputs = corrections || endSession.output_data;
        if (typeof outputs === 'string') {
            try {
                outputs = JSON.parse(outputs);
            } catch (e) {
                throw new BusinessRuleError('Data output tidak valid (format JSON salah)');
            }
        }
        if (!outputs || !Array.isArray(outputs)) throw new BusinessRuleError('Data output tidak valid (harus berupa array)');

        // Use the existing completeProcess logic but adapted for this flow
        const processService = require('./process.service');
        
        // We'll call completeProcess from processService
        // But wait, completeProcess currently takes raw fields.
        // I'll need to make sure I pass everything correctly.
        
        return processService.completeProcess(
            processId, 
            outputs, 
            adminId, 
            endSession.notes,
            0, // sekam_kg handled in outputs
            '', 
            0, 
            ''
        );
    }
}

module.exports = new MillingService();
