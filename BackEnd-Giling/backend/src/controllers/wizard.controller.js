const wizardService = require('../services/wizard.service');
const { SaveWizardStateCommand, AdvanceWizardStepCommand } = require('../dtos/wizard.dto');
const WizardMapper = require('../mappers/wizard.mapper');

// Get wizard state
const getWizardState = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user.id;

    const state = await wizardService.getWizardState(userId, entityType, entityId);

    res.json({
      success: true,
      data: WizardMapper.toResponse(state)
    });
  } catch (error) {
    next(error);
  }
};

// Save wizard state
const saveWizardState = async (req, res, next) => {
  try {
    const command = new SaveWizardStateCommand(req.user.id, req.params.entityType, req.params.entityId, req.body);

    const state = await wizardService.saveWizardState(
      command.userId,
      command.entityType,
      command.entityId,
      command.currentStep,
      command.stepData
    );

    res.json({
      success: true,
      data: WizardMapper.toResponse(state)
    });
  } catch (error) {
    next(error);
  }
};

// Advance wizard step
const advanceWizardStep = async (req, res, next) => {
  try {
    const command = new AdvanceWizardStepCommand(req.user.id, req.params.entityType, req.params.entityId, req.body);

    const state = await wizardService.advanceStep(
      command.userId,
      command.entityType,
      command.entityId,
      command.nextStep,
      command.additionalData
    );

    res.json({
      success: true,
      data: WizardMapper.toResponse(state)
    });
  } catch (error) {
    next(error);
  }
};

// Delete wizard state (complete wizard)
const completeWizard = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const userId = req.user.id;

    await wizardService.deleteWizardState(userId, entityType, entityId);

    res.json({
      success: true,
      message: 'Wizard completed and state cleared'
    });
  } catch (error) {
    next(error);
  }
};

// Get all active wizards for current user
const getActiveWizards = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const wizards = await wizardService.getActiveWizards(userId);

    res.json({
      success: true,
      data: wizards.map(WizardMapper.toResponse)
    });
  } catch (error) {
    next(error);
  }
};

// Get wizard steps configuration
const getWizardSteps = async (req, res, next) => {
  try {
    const { entityType } = req.params;

    let steps;
    if (entityType === 'batch') {
      steps = wizardService.getBatchWizardSteps();
    } else if (entityType === 'process') {
      steps = wizardService.getProcessWizardSteps();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type'
      });
    }

    res.json({
      success: true,
      data: steps
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWizardState,
  saveWizardState,
  advanceWizardStep,
  completeWizard,
  getActiveWizards,
  getWizardSteps
};
