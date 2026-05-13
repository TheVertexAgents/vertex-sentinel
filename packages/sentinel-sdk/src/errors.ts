export class SentinelError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'SentinelError';
  }
}

export class InsufficientCollateralError extends SentinelError {
  constructor(message = 'Insufficient collateral') {
    super(message);
    this.name = 'InsufficientCollateralError';
  }
}

export class StalePriceError extends SentinelError {
  constructor(message = 'Stale price feed') {
    super(message);
    this.name = 'StalePriceError';
  }
}

export class FailClosedException extends SentinelError {
  constructor(message = 'Fail-closed: enforcement engaged') {
    super(message);
    this.name = 'FailClosedException';
  }
}

export class InsufficientQuotaError extends SentinelError {
  constructor(message = 'Insufficient AI quota') {
    super(message);
    this.name = 'InsufficientQuotaError';
  }
}
