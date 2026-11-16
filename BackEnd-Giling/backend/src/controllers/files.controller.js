const fileService = require('../services/file.service');
const { FILE_TYPES } = require('../utils/constants');
const { UploadFileCommand } = require('../dtos/file.dto');
const FileMapper = require('../mappers/file.mapper');

// Upload file
const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const command = new UploadFileCommand(req.body, req.file);

    // Validate fileType
    if (!Object.values(FILE_TYPES).includes(command.fileType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type'
      });
    }

    // Validate that at least one association is provided
    if (!command.purchaseId && !command.processId && !command.saleId) {
      return res.status(400).json({
        success: false,
        message: 'File must be associated with purchase, process, or sale'
      });
    }

    // Upload to R2
    const r2Key = await fileService.uploadFile(
      command.file.buffer,
      command.file.originalname,
      command.file.mimetype,
      command.fileType
    );

    // Save metadata to database
    const file = await fileService.saveFileMetadata({
      purchaseId: command.purchaseId,
      processId: command.processId,
      saleId: command.saleId,
      saleType: command.saleType,
      fileType: command.fileType,
      r2Key,
      originalName: command.file.originalname,
      mimeType: command.file.mimetype,
      sizeBytes: command.file.size,
      createdBy: req.user?.id || null   // attribute upload to the authenticated user
    });

    // Get signed URL
    const fileWithUrl = await fileService.getFileById(file.id);

    res.status(201).json({
      success: true,
      data: FileMapper.toResponse(fileWithUrl)
    });
  } catch (error) {
    next(error);
  }
};

// Get files by purchase
const getFilesByPurchase = async (req, res, next) => {
  try {
    const { purchaseId } = req.params;
    const files = await fileService.getFilesByPurchase(purchaseId);

    res.json({
      success: true,
      data: files.map(FileMapper.toResponse)
    });
  } catch (error) {
    next(error);
  }
};

// Get files by process
const getFilesByProcess = async (req, res, next) => {
  try {
    const { processId } = req.params;
    const files = await fileService.getFilesByProcess(processId);

    res.json({
      success: true,
      data: files.map(FileMapper.toResponse)
    });
  } catch (error) {
    next(error);
  }
};

// Get files by sale
const getFilesBySale = async (req, res, next) => {
  try {
    const { saleType, saleId } = req.params;
    const files = await fileService.getFilesBySale(saleType, saleId);

    res.json({
      success: true,
      data: files.map(FileMapper.toResponse)
    });
  } catch (error) {
    next(error);
  }
};

// Get file by ID
const getFileById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const file = await fileService.getFileById(id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      data: FileMapper.toResponse(file)
    });
  } catch (error) {
    next(error);
  }
};

// Delete file
const deleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const file = await fileService.deleteFile(id);

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: FileMapper.toResponse(file)
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  getFilesByPurchase,
  getFilesByProcess,
  getFilesBySale,
  getFileById,
  deleteFile
};
