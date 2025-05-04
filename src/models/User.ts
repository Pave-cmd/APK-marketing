import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

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
    platform: string;
    accountId: string;
    accessToken: string;
    isConnected: boolean;
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
    isConnected: {
      type: Boolean,
      default: true,
    },
  }],
});

// Před uložením hashujeme heslo
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error: any) {
    return next(error);
  }
});

// Metoda pro porovnání hesla
UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    return false;
  }
};

export default mongoose.model<IUser>('User', UserSchema);