import mongoose, { Document, Schema } from 'mongoose';

// Rozhraní pro naplánovaný příspěvek
export interface IScheduledPost extends Document {
  userId: mongoose.Types.ObjectId;
  socialNetworkId: mongoose.Types.ObjectId;
  contentId?: mongoose.Types.ObjectId;
  websiteUrl: string;
  title: string;
  content: string;
  imageUrl?: string;
  platform: string;
  scheduledFor: Date;
  status: string;
  recurrence?: {
    pattern: string;    // 'daily', 'weekly', 'monthly'
    dayOfWeek?: number; // 0 = Sunday, 6 = Saturday (for weekly)
    dayOfMonth?: number; // 1-31 (for monthly)
    time: string;       // '08:00'
    endDate?: Date;     // When to stop recurring posts
  };
  publishedAt?: Date;
  failedAttempts?: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    hashtags?: string[];
    targetAudience?: string;
    campaignId?: string;
    useAi?: boolean;
    aiPrompt?: string;
  };
}

// Schema pro naplánovaný příspěvek
const ScheduledPostSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  socialNetworkId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  contentId: {
    type: Schema.Types.ObjectId,
    ref: 'Content',
    required: false,
  },
  websiteUrl: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
  },
  platform: {
    type: String,
    enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'pinterest', 'tiktok', 'youtube'],
    required: true,
  },
  scheduledFor: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'published', 'failed', 'cancelled'],
    default: 'pending',
  },
  recurrence: {
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },
    time: {
      type: String, // '08:00'
    },
    endDate: {
      type: Date,
    },
  },
  publishedAt: {
    type: Date,
  },
  failedAttempts: {
    type: Number,
    default: 0,
  },
  lastError: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    hashtags: [{
      type: String,
    }],
    targetAudience: {
      type: String,
    },
    campaignId: {
      type: String,
    },
    useAi: {
      type: Boolean,
      default: false,
    },
    aiPrompt: {
      type: String,
    },
  },
});

// Před aktualizací záznamu aktualizujeme hodnotu updatedAt
ScheduledPostSchema.pre('findOneAndUpdate', function() {
  const update = this.getUpdate() as any;
  if (update) {
    update.updatedAt = new Date();
  }
});

export default mongoose.model<IScheduledPost>('ScheduledPost', ScheduledPostSchema);