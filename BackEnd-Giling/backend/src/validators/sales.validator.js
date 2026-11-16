const Joi = require('joi');
const { HASIL_KUALITAS } = require('../utils/constants');

// Beras (detailed)
const createBerasSchema = Joi.object({
  nama: Joi.string().max(255).required(),
  tanggalJual: Joi.date().iso().allow(null),
  calo: Joi.string().max(255).required(),
  hargaJualPerKg: Joi.number().positive().precision(2).required(),
  hargaJualTotal: Joi.number().positive().precision(2).allow(null),
  jualKemana: Joi.string().max(255).allow(null, ''),
  tonase: Joi.number().positive().precision(2).required(),
  rendemen: Joi.number().min(0).max(100).precision(2).required(),
  hasilAkhir: Joi.string().valid(...Object.values(HASIL_KUALITAS)).required(),
  derajatSosoh: Joi.number().min(0).max(100).precision(2).allow(null),
  butirPatah: Joi.number().min(0).max(100).precision(2).allow(null),
  butirKepala: Joi.number().min(0).max(100).precision(2).allow(null),
  kadarAir: Joi.number().min(0).max(100).precision(2).allow(null),
  bendaAsing: Joi.number().min(0).max(100).precision(2).allow(null)
});

const updateBerasSchema = Joi.object({
  nama: Joi.string().max(255),
  tanggalJual: Joi.date().iso().allow(null),
  calo: Joi.string().max(255),
  hargaJualPerKg: Joi.number().positive().precision(2),
  hargaJualTotal: Joi.number().positive().precision(2).allow(null),
  jualKemana: Joi.string().max(255).allow(null, ''),
  tonase: Joi.number().positive().precision(2),
  rendemen: Joi.number().min(0).max(100).precision(2),
  hasilAkhir: Joi.string().valid(...Object.values(HASIL_KUALITAS)),
  derajatSosoh: Joi.number().min(0).max(100).precision(2).allow(null),
  butirPatah: Joi.number().min(0).max(100).precision(2).allow(null),
  butirKepala: Joi.number().min(0).max(100).precision(2).allow(null),
  kadarAir: Joi.number().min(0).max(100).precision(2).allow(null),
  bendaAsing: Joi.number().min(0).max(100).precision(2).allow(null)
}).min(1);

// Simplified (dedak, sekam, menir, broken)
const createSimplifiedSaleSchema = Joi.object({
  nama: Joi.string().max(255).required(),
  tanggalJual: Joi.date().iso().allow(null),
  tonase: Joi.number().positive().precision(2).required(),
  hargaPerKg: Joi.number().positive().precision(2).required(),
  hargaTotal: Joi.number().positive().precision(2).allow(null)
});

const updateSimplifiedSaleSchema = Joi.object({
  nama: Joi.string().max(255),
  tanggalJual: Joi.date().iso().allow(null),
  tonase: Joi.number().positive().precision(2),
  hargaPerKg: Joi.number().positive().precision(2),
  hargaTotal: Joi.number().positive().precision(2).allow(null)
}).min(1);

module.exports = {
  createBerasSchema,
  updateBerasSchema,
  createSimplifiedSaleSchema,
  updateSimplifiedSaleSchema
};
