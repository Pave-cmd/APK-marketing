import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { normalizeUrl } from '../utils/urlUtils';

// Rozhraní pro uživatele
export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
  plan: string;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
  websites: string[];
  socialNetworks: {
    _id?: any;
    platform: string;
    accountId: string;
    accessToken: string;
    refreshToken?: string;
    isConnected: boolean;
    connectedAt?: Date;
  }[];
  comparePassword(password: string): Promise<boolean>;
}

// Schéma pro uživatele
const UserSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  company: {
    type: String,
    trim: true,
  },
  plan: {
    type: String,
    enum: ['basic', 'standard', 'premium', 'enterprise'],
    default: 'basic',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
  websites: [{
    type: String,
    trim: true,
    set: (url: string) => normalizeUrl(url, { keepTrailingSlash: false }),
    get: (url: string) => url
  }],
  socialNetworks: [{
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'pinterest', 'tiktok', 'youtube'],
      required: true,
    },
    accountId: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: false,
    },
    isConnected: {
      type: Boolean,
      default: true,
    },
    connectedAt: {
      type: Date,
      required: false,
    },
  }],
});

// Před uložením hashujeme heslo
UserSchema.pre<IUser>('save', async function(next) {
  try {
    // Logování aktualizace webových stránek
    if (this.isModified('websites')) {
      console.log('[USER MODEL] Ukládám uživatele s změněnými weby:', {
        id: this._id,
        email: this.email,
        websites: this.websites
      });
    }

    // Hashování hesla pouze pokud bylo změněno
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    return next();
  } catch (e) {
    console.error('[USER MODEL] Chyba při ukládání uživatele:', e);
    // Přidáno typování: zpracování chyby jako mongoose CallbackError
    return next(e as mongoose.CallbackError);
  }
});

// Metoda pro porovnání hesla
UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, this.password);
  } catch {
    // Ignorujeme konkrétní chybu a vracíme false
    return false;
  }
};

export default mongoose.model<IUser>('User', UserSchema);