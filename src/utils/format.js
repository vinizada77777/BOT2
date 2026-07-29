'use strict';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function progressBar(currentValue, targetValue, size = 20) {
  const current = Number(currentValue || 0);
  const target = Number(targetValue || 0);
  const ratio = target > 0 ? Math.max(0, Math.min(current / target, 1)) : 0;
  const filled = Math.round(ratio * size);
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)} ${(ratio * 100).toFixed(1)}%`;
}

function truncate(value, maxLength, fallback = 'Não informado') {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

module.exports = { formatNumber, progressBar, truncate };
