/**
 * BinaryCode Abstraction
 * Supports arbitrary code widths with BigInt authoritative representation,
 * Uint8Array for bit-level processing, and native fast bitwise operations.
 * Explicitly avoids JavaScript finite Number precision limits.
 */

export class BinaryCode {
  private readonly _bitLength: number;
  private readonly _value: bigint;
  private _cachedBits: Uint8Array | null = null;

  constructor(value: bigint, bitLength: number) {
    if (bitLength <= 0) {
      throw new Error(`Bit length must be positive, got ${bitLength}`);
    }
    this._bitLength = bitLength;
    // Mask value to exact bitLength to avoid overflow
    const mask = (1n << BigInt(bitLength)) - 1n;
    this._value = value & mask;
  }

  get bitLength(): number {
    return this._bitLength;
  }

  get value(): bigint {
    return this._value;
  }

  /**
   * Create BinaryCode from Uint8Array or array of 0s and 1s.
   * Convention: index 0 is most significant bit (MSB) or cell (0,0).
   */
  static fromBits(bits: Uint8Array | number[]): BinaryCode {
    const bitLength = bits.length;
    let val = 0n;
    for (let i = 0; i < bitLength; i++) {
      if (bits[i]) {
        val |= 1n << BigInt(bitLength - 1 - i);
      }
    }
    const code = new BinaryCode(val, bitLength);
    code._cachedBits = new Uint8Array(bits);
    return code;
  }

  /**
   * Create BinaryCode from a BigInt with explicit bit length.
   */
  static fromBigInt(value: bigint, bitLength: number): BinaryCode {
    return new BinaryCode(value, bitLength);
  }

  /**
   * Create BinaryCode from a binary string e.g. "10110010..."
   */
  static fromString(binaryStr: string): BinaryCode {
    const cleanStr = binaryStr.replace(/[^01]/g, '');
    const bitLength = cleanStr.length;
    if (bitLength === 0) {
      throw new Error('Binary string must contain at least one bit (0 or 1)');
    }
    const bits = new Uint8Array(bitLength);
    for (let i = 0; i < bitLength; i++) {
      bits[i] = cleanStr.charCodeAt(i) === 49 ? 1 : 0;
    }
    return BinaryCode.fromBits(bits);
  }

  /**
   * Create BinaryCode from a hex string e.g. "0x2A" or "ff01"
   */
  static fromHex(hexStr: string, bitLength: number): BinaryCode {
    const cleanHex = hexStr.startsWith('0x') || hexStr.startsWith('0X')
      ? hexStr.slice(2)
      : hexStr;
    const value = BigInt('0x' + (cleanHex || '0'));
    return new BinaryCode(value, bitLength);
  }

  /**
   * Generate a pseudo-random BinaryCode of specified length.
   */
  static random(bitLength: number): BinaryCode {
    const bits = new Uint8Array(bitLength);
    for (let i = 0; i < bitLength; i++) {
      bits[i] = Math.random() < 0.5 ? 0 : 1;
    }
    return BinaryCode.fromBits(bits);
  }

  /**
   * Retrieve bit at index (0 is MSB / cell (0,0)).
   */
  getBit(index: number): number {
    if (index < 0 || index >= this._bitLength) {
      throw new RangeError(`Index ${index} out of bounds for length ${this._bitLength}`);
    }
    const shift = BigInt(this._bitLength - 1 - index);
    return Number((this._value >> shift) & 1n);
  }

  /**
   * Return a new BinaryCode with bit at index updated.
   */
  setBit(index: number, val: number): BinaryCode {
    if (index < 0 || index >= this._bitLength) {
      throw new RangeError(`Index ${index} out of bounds for length ${this._bitLength}`);
    }
    const shift = BigInt(this._bitLength - 1 - index);
    const bitMask = 1n << shift;
    let newVal: bigint;
    if (val) {
      newVal = this._value | bitMask;
    } else {
      newVal = this._value & ~bitMask;
    }
    return new BinaryCode(newVal, this._bitLength);
  }

  /**
   * Flip single bit at index.
   */
  flipBit(index: number): BinaryCode {
    if (index < 0 || index >= this._bitLength) {
      throw new RangeError(`Index ${index} out of bounds for length ${this._bitLength}`);
    }
    const shift = BigInt(this._bitLength - 1 - index);
    return new BinaryCode(this._value ^ (1n << shift), this._bitLength);
  }

  /**
   * Flip multiple bits at specified indices.
   */
  flipBits(indices: number[]): BinaryCode {
    let mask = 0n;
    for (const idx of indices) {
      if (idx >= 0 && idx < this._bitLength) {
        mask |= 1n << BigInt(this._bitLength - 1 - idx);
      }
    }
    return new BinaryCode(this._value ^ mask, this._bitLength);
  }

  /**
   * Bitwise XOR with another BinaryCode.
   */
  xor(other: BinaryCode): BinaryCode {
    if (this._bitLength !== other._bitLength) {
      throw new Error(`Mismatched bit lengths: ${this._bitLength} vs ${other._bitLength}`);
    }
    return new BinaryCode(this._value ^ other._value, this._bitLength);
  }

  /**
   * Compute Hamming distance against another BinaryCode.
   * Leverages BigInt XOR and optimized popcount.
   */
  hammingDistance(other: BinaryCode): number {
    if (this._bitLength !== other._bitLength) {
      throw new Error(`Mismatched bit lengths: ${this._bitLength} vs ${other._bitLength}`);
    }
    return BinaryCode.popcountBigInt(this._value ^ other._value);
  }

  /**
   * Count number of set bits (popcount).
   */
  popcount(): number {
    return BinaryCode.popcountBigInt(this._value);
  }

  /**
   * Fast popcount for BigInt of arbitrary bit width.
   * Splits BigInt into 32-bit chunks and counts bits.
   */
  private static popcountBigInt(val: bigint): number {
    let count = 0;
    let temp = val;
    const mask32 = 0xffffffffn;
    while (temp > 0n) {
      let chunk = Number(temp & mask32);
      // Fast 32-bit Hamming weight
      chunk = chunk - ((chunk >> 1) & 0x55555555);
      chunk = (chunk & 0x33333333) + ((chunk >> 2) & 0x33333333);
      chunk = (chunk + (chunk >> 4)) & 0x0f0f0f0f;
      count += (chunk * 0x01010101) >> 24;
      temp >>= 32n;
    }
    return count;
  }

  /**
   * Convert to Uint8Array where index 0 is MSB.
   */
  toBitArray(): Uint8Array {
    if (!this._cachedBits) {
      const bits = new Uint8Array(this._bitLength);
      for (let i = 0; i < this._bitLength; i++) {
        const shift = BigInt(this._bitLength - 1 - i);
        bits[i] = Number((this._value >> shift) & 1n);
      }
      this._cachedBits = bits;
    }
    return new Uint8Array(this._cachedBits);
  }

  toBigInt(): bigint {
    return this._value;
  }

  toBinaryString(): string {
    const raw = this._value.toString(2);
    return raw.padStart(this._bitLength, '0');
  }

  toHexString(): string {
    const hexDigits = Math.ceil(this._bitLength / 4);
    const raw = this._value.toString(16);
    return '0x' + raw.padStart(hexDigits, '0');
  }

  equals(other: BinaryCode): boolean {
    return this._bitLength === other._bitLength && this._value === other._value;
  }

  clone(): BinaryCode {
    return new BinaryCode(this._value, this._bitLength);
  }
}
