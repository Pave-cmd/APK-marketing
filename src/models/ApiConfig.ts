import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

// Rozhraní pro API konfiguraci
export interface IApiConfig extends Document {
  platform: string;
  appId: string;
  appSecret: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  longLivedToken?: string; // dlouhodobý token pro aplikaci
  tokenExpiry?: Date;       // datum expirace tokenu
  pageTokens?: {
    pageId: string;
    accessToken: string;
    name: string;
    expiresAt?: Date;
  }[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  encrypt(text: string): string;
  decrypt(text: string): string;
  getDecryptedConfig(): {
    platform: string;
    appId: string;
    appSecret?: string;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    longLivedToken?: string;
    tokenExpiry?: Date;
    pageTokens?: {
      pageId: string;
      accessToken: string;
      name: string;
      expiresAt?: Date;
    }[];
  };
}

// Schéma pro API konfiguraci
const ApiConfigSchema: Schema = new Schema({
  platform: {
    type: String,
    enum: ['facebook', 'twitter', 'linkedin', 'instagram', 'pinterest', 'tiktok', 'youtube'],
    required: true,
    unique: true,
  },
  appId: {
    type: String,
    required: false,
  },
  appSecret: {
    type: String,
    required: false,
  },
  clientId: {
    type: String,
    required: false,
  },
  clientSecret: {
    type: String,
    required: false,
  },
  redirectUri: {
    type: String,
    required: false,
  },
  longLivedToken: {
    type: String,
    required: false,
  },
  tokenExpiry: {
    type: Date,
    required: false,
  },
  pageTokens: [{
    pageId: {
      type: String,
      required: true
    },
    accessToken: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: false
    }
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Šifrovací klíč - v produkci by měl být v ENV
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!';
const IV_LENGTH = 16;

// Metody pro šifrování a dešifrování
ApiConfigSchema.methods.encrypt = function(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf-8'),
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
};

ApiConfigSchema.methods.decrypt = function(text: string): string {
  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf-8'),
      iv
    );
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
};

// Před uložením šifrujeme citlivé údaje
ApiConfigSchema.pre<IApiConfig>('save', function(next) {
  try {
    console.log('Pre-save hook - data before encryption:', {
      platform: this.platform,
      appId: this.appId,
      appSecret: this.appSecret ? 'Has value' : 'No value',
      clientId: this.clientId,
      clientSecret: this.clientSecret ? 'Has value' : 'No value',
      longLivedToken: this.longLivedToken ? 'Has value' : 'No value',
      pageTokens: this.pageTokens ? `${this.pageTokens.length} tokens` : 'No tokens'
    });
    
    if (this.isModified('appSecret') && this.appSecret) {
      this.appSecret = this.encrypt(this.appSecret);
      console.log('Encrypted appSecret');
    }
    if (this.isModified('clientSecret') && this.clientSecret) {
      this.clientSecret = this.encrypt(this.clientSecret);  
      console.log('Encrypted clientSecret');
    }
    if (this.isModified('longLivedToken') && this.longLivedToken) {
      this.longLivedToken = this.encrypt(this.longLivedToken);
      console.log('Encrypted longLivedToken');
    }
    
    // Šifrujeme i tokeny pro stránky, pokud byly modifikovány
    if (this.isModified('pageTokens') && this.pageTokens && this.pageTokens.length > 0) {
      this.pageTokens = this.pageTokens.map(token => {
        if (token.accessToken && !token.accessToken.includes(':')) { // Jednoduchá kontrola, jestli token není již zašifrovaný
          return {
            ...token,
            accessToken: this.encrypt(token.accessToken)
          };
        }
        return token;
      });
      console.log('Encrypted page tokens');
    }
    
    this.updatedAt = new Date();
    next();
  } catch (error) {
    console.error('Pre-save hook error:', error);
    next(error as Error);
  }
});

// Helper metoda pro získání dešifrovaných hodnot
ApiConfigSchema.methods.getDecryptedConfig = function() {
  // Dešifrujeme tokeny pro stránky, pokud existují
  const decryptedPageTokens = this.pageTokens?.map((token: { pageId: string; name: string; accessToken?: string; expiresAt?: Date }) => ({
    pageId: token.pageId,
    name: token.name,
    accessToken: token.accessToken ? this.decrypt(token.accessToken) : undefined,
    expiresAt: token.expiresAt
  }));
  
  return {
    platform: this.platform,
    appId: this.appId,
    appSecret: this.appSecret ? this.decrypt(this.appSecret) : undefined,
    clientId: this.clientId,
    clientSecret: this.clientSecret ? this.decrypt(this.clientSecret) : undefined,
    redirectUri: this.redirectUri,
    longLivedToken: this.longLivedToken ? this.decrypt(this.longLivedToken) : undefined,
    tokenExpiry: this.tokenExpiry,
    pageTokens: decryptedPageTokens
  };
};

export default mongoose.model<IApiConfig>('ApiConfig', ApiConfigSchema);