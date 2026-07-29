'use strict';

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif)$/i;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function isImageAttachment(attachment) {
  if (!attachment) return false;
  const contentTypeMatches = attachment.contentType?.startsWith('image/');
  const extensionMatches = IMAGE_EXTENSION.test(attachment.name || '');
  const validSize = !attachment.size || attachment.size <= MAX_IMAGE_BYTES;
  return Boolean((contentTypeMatches || extensionMatches) && validSize);
}

function requiredText(value, fieldName, maxLength) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${fieldName} é obrigatório.`);
  if (text.length > maxLength) throw new Error(`${fieldName} excede ${maxLength} caracteres.`);
  return text;
}

function positiveAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error('A quantidade precisa ser maior que zero.');
  }
  return number;
}

function safeImageFilename(prefix, attachment) {
  const match = String(attachment?.name || '').match(IMAGE_EXTENSION);
  const extension = match ? match[0].toLowerCase().replace('.jpeg', '.jpg') : '.png';
  return `${String(prefix).replace(/[^a-z0-9-_]/gi, '-')}${extension}`;
}

module.exports = {
  IMAGE_EXTENSION,
  MAX_IMAGE_BYTES,
  isImageAttachment,
  requiredText,
  positiveAmount,
  safeImageFilename
};
