'use strict';

class AppError extends Error {
  constructor(code, publicMessage, options = {}) {
    super(options.internalMessage || publicMessage, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.publicMessage = publicMessage;
    this.details = options.details || null;
  }
}

module.exports = { AppError };
