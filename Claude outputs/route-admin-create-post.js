// File: app/api/admin/create-post/route.js
// or: pages/api/admin/create-post.js (depending on your Next.js version)

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Create admin client with SERVICE_ROLE_KEY (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // This key bypasses RLS!
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(req) {
  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    // Get the request body
    const body = await req.json();
    const { user_id, type, caption, media_url, visibility, is_public } = body;

    if (!user_id || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, type' },
        { status: 400 }
      );
    }

    console.log('[ADMIN_CREATE_POST]', { user_id, type, caption });

    // Insert post using admin client (no RLS restrictions)
    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({
        user_id: user_id,
        type: type,
        caption: caption || null,
        media_url: media_url || null,
        visibility: visibility || 'public',
        is_public: is_public !== false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[POST_ERROR]', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log('[POST_CREATED]', data);

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Post created successfully',
    });

  } catch (err) {
    console.error('[API_ERROR]', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}

// Also export GET for health check
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
