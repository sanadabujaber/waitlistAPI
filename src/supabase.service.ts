import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.get<string>('supabase.url') ?? '',
      config.get<string>('supabase.anonKey') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  /** Validates a Supabase access token and returns its user, or null. */
  async getUser(jwt: string): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser(jwt);
    if (error || !data.user) return null;
    return data.user;
  }
}
