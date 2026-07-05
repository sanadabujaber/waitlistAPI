import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('supabase.url') ?? '';
    const anonKey = config.get<string>('supabase.anonKey') ?? '';
    this.client = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  }

  /** Validates a Supabase access token and returns its user, or null. */
  async getUser(jwt: string): Promise<User | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getUser(jwt);
    if (error || !data.user) return null;
    return data.user;
  }
}
