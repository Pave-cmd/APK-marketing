import mongoose, { Document, Schema } from 'mongoose';
import { normalizeUrl } from '../utils/urlUtils';

// Rozhraní pro obsahový příspěvek
export interface IContent extends Document {
  userId: mongoose.Types.ObjectId;
  websiteUrl: string;
  sourceUrl?: string;
  title: string;
  description: string;
  imageUrl?: string;
  textContent: string;
  status: string;
  socialPlatforms: {
    platform: string;
    postId?: string;
    publishedAt?: Date;
    engagement?: {
      likes?: number;
      shares?: number;
      comments?: number;
      clicks?: number;
    };
    status: string;
  }[];
  scheduledFor?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  aiGeneratedDetails?: {
    promptUsed: string;
    modelVersion: string;
    generationDate: Date;
  };
}

// Schema pro obsah
const ContentSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  websiteUrl: {
    type: String,
    required: true,
    set: (url: string) => normalizeUrl(url, { keepTrailingSlash: false }),
    get: (url: string) => url
  },
  sourceUrl: {
    type: String,
    set: (url: string) => url ? normalizeUrl(url, { keepTrailingSlash: false }) : url,
    get: (url: string) => url
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
  },
  textContent: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'failed'],
    default: 'draft',
  },
  socialPlatforms: [{
    platform: {
      type: String,
      enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'pinterest', 'tiktok', 'youtube'],
      required: true,
    },
    postId: {
      type: String,
    },
    publishedAt: {
      type: Date,
    },
    engagement: {
      likes: Number,
      shares: Number,
      comments: Number,
      clicks: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'published', 'failed'],
      default: 'pending',
    },
  }],
  scheduledFor: {
    type: Date,
  },
  publishedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  tags: [{
    type: String,
  }],
  aiGeneratedDetails: {
    promptUsed: String,
    modelVersion: String,
    generationDate: Date,
  },
});

// Před aktualizací záznamu aktualizujeme hodnotu updatedAt
ContentSchema.pre('findOneAndUpdate', function() {
  const update = this.getUpdate() as any;
  if (update) {
    update.updatedAt = new Date();
  }
});

export default mongoose.model<IContent>('Content', ContentSchema);