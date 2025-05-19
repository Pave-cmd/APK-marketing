import mongoose, { Document, Schema } from 'mongoose';

export interface IWebAnalysis extends Document {
  userId: mongoose.Types.ObjectId;
  websiteUrl: string;
  status: 'pending' | 'scanning' | 'extracting' | 'generating' | 'publishing' | 'completed' | 'failed';
  lastScan: Date;
  nextScan: Date;
  scannedContent: {
    title: string;
    description: string;
    images: string[];
    mainText: string;
    keywords: string[];
    products?: any[];
  };
  generatedContent: {
    facebook?: {
      text: string;
      image?: string;
      scheduledFor?: Date;
      published?: boolean;
      publishedAt?: Date;
    };
    twitter?: {
      text: string;
      image?: string;
      scheduledFor?: Date;
      published?: boolean;
      publishedAt?: Date;
    };
    linkedin?: {
      text: string;
      image?: string;
      scheduledFor?: Date;
      published?: boolean;
      publishedAt?: Date;
    };
  };
  error?: string;
  scanFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  createdAt: Date;
  updatedAt: Date;
}

const WebAnalysisSchema = new Schema<IWebAnalysis>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  websiteUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'scanning', 'extracting', 'generating', 'publishing', 'completed', 'failed'],
    default: 'pending'
  },
  lastScan: {
    type: Date,
    default: null
  },
  nextScan: {
    type: Date,
    default: Date.now
  },
  scannedContent: {
    title: String,
    description: String,
    images: [String],
    mainText: String,
    keywords: [String],
    products: [Schema.Types.Mixed]
  },
  generatedContent: {
    facebook: {
      text: String,
      image: String,
      scheduledFor: Date,
      published: { type: Boolean, default: false },
      publishedAt: Date
    },
    twitter: {
      text: String,
      image: String,
      scheduledFor: Date,
      published: { type: Boolean, default: false },
      publishedAt: Date
    },
    linkedin: {
      text: String,
      image: String,
      scheduledFor: Date,
      published: { type: Boolean, default: false },
      publishedAt: Date
    }
  },
  error: String,
  scanFrequency: {
    type: String,
    enum: ['hourly', 'daily', 'weekly', 'monthly'],
    default: 'daily'
  }
}, {
  timestamps: true
});

// Index pro rychlé vyhledávání
WebAnalysisSchema.index({ userId: 1, websiteUrl: 1 });
WebAnalysisSchema.index({ status: 1, nextScan: 1 });

export default mongoose.model<IWebAnalysis>('WebAnalysis', WebAnalysisSchema);