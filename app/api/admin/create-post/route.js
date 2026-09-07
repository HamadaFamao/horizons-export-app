import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { user_id, type, caption, media_url, visibility, is_public } = body;

    if (!user_id || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id and type' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({
        user_id,
        type,
        caption: caption ?? null,
        media_url: media_url ?? null,
        visibility: visibility ?? 'public',
        is_public: is_public ?? true,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select()
      .single();

    if (error) {
      console.error('[ADMIN_CREATE_POST]', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[ADMIN_CREATE_POST]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
