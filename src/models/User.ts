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
  role?: string;
  websites: string[];
  gdprConsent: {
    analytics: boolean;
    marketing: boolean;
    functional: boolean;
    consentDate: Date;
    ipAddress?: string;
    userAgent?: string;
  };
  dataProcessingConsent: {
    contentGeneration: boolean;
    socialMediaPosting: boolean;
    websiteAnalysis: boolean;
    consentDate: Date;
  };
  // GDPR compliance fields
  dataExportRequest?: Date;
  dataDeletionRequest?: Date;
  consentGiven: boolean;
  consentDate: Date;
  socialNetworks: {
    _id?: any;
    platform: string;
    username?: string;       // Uživatelské jméno na platformě
    accountId?: string;      // ID účtu na platformě (pro zpětnou kompatibilitu)
    lastChecked?: Date;      // Kdy byla naposled ověřena platnost propojení
    
    // Facebook specifické pole
    pageId?: string;         // ID stránky pro publikování
    pageName?: string;       // Název stránky
    
    // Twitter specifické pole
    screenName?: string;     // Twitter přezdívka (@...)
    
    // LinkedIn specifické pole
    linkedinCompanyId?: string; // ID firmy na LinkedIn, pokud se používá
    
    // Obecná metadata
    status?: string;         // Status připojení (active, error, expired, pending)
    lastPostAt?: Date;       // Kdy byl naposledy publikován příspěvek
    errorMessage?: string;   // Poslední chybová zpráva
    connectedAt?: Date;      // Kdy bylo připojení vytvořeno
    
    // Nastavení publikování
    publishSettings?: {
      autoPublish: boolean;   // Automatické publikování
      frequency: string;      // Jak často publikovat (daily, weekly, monthly)
      contentType: string;    // Jaký typ obsahu publikovat (blog, products, news)
      bestTimeToPost: boolean; // Publikovat v optimální čas
      
      // Pokročilejší nastavení
      tone?: string;          // Tón příspěvků (casual, professional, friendly, formal)
      hashtags?: string;      // Množství hashtagů (none, few, many)
      emoji?: string;         // Množství emoji (none, few, many)
      includeImage?: boolean; // Přidat obrázek k příspěvku
    };
    
    // Flexibilní objekt pro různá metadata specifická pro platformu
    metadata?: Record<string, any>;
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
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  websites: [{
    type: String,
    trim: true,
    set: (url: string) => normalizeUrl(url, { keepTrailingSlash: false }),
    get: (url: string) => url
  }],
  gdprConsent: {
    analytics: {
      type: Boolean,
      default: false,
    },
    marketing: {
      type: Boolean,
      default: false,
    },
    functional: {
      type: Boolean,
      default: false,
    },
    consentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
  },
  dataProcessingConsent: {
    contentGeneration: {
      type: Boolean,
      default: true,
      required: true,
    },
    socialMediaPosting: {
      type: Boolean,
      default: false,
    },
    websiteAnalysis: {
      type: Boolean,
      default: false,
    },
    consentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  // GDPR compliance fields
  dataExportRequest: {
    type: Date,
    required: false,
  },
  dataDeletionRequest: {
    type: Date,
    required: false,
  },
  consentGiven: {
    type: Boolean,
    default: false,
    required: true,
  },
  consentDate: {
    type: Date,
    required: false,
  },
  socialNetworks: [{
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'pinterest', 'tiktok', 'youtube'],
      required: true,
    },
    username: {
      type: String,
      required: false,
    },
    accountId: {
      type: String,
      required: false,
    },
    lastChecked: {
      type: Date,
      required: false,
    },
    // Facebook specifická pole
    pageId: {
      type: String,
      required: false,
    },
    pageName: {
      type: String,
      required: false,
    },
    // Twitter specifická pole
    screenName: {
      type: String,
      required: false,
    },
    // LinkedIn specifická pole
    linkedinCompanyId: {
      type: String,
      required: false,
    },
    // Obecná metadata
    status: {
      type: String,
      enum: ['active', 'error', 'expired', 'pending'],
      default: 'pending',
    },
    lastPostAt: {
      type: Date,
      required: false,
    },
    errorMessage: {
      type: String,
      required: false,
    },
    connectedAt: {
      type: Date,
      required: false,
    },
    publishSettings: {
      autoPublish: {
        type: Boolean,
        default: true,
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'weekly',
      },
      contentType: {
        type: String,
        enum: ['blog', 'products', 'news', 'mix'],
        default: 'mix',
      },
      bestTimeToPost: {
        type: Boolean,
        default: true,
      },
      tone: {
        type: String,
        enum: ['casual', 'professional', 'friendly', 'formal'],
        default: 'professional',
      },
      hashtags: {
        type: String,
        enum: ['none', 'few', 'many'],
        default: 'few',
      },
      emoji: {
        type: String,
        enum: ['none', 'few', 'many'],
        default: 'few',
      },
      includeImage: {
        type: Boolean,
        default: true,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
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