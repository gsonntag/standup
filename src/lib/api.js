import { NextResponse } from 'next/server';
import { getCurrentUser } from './auth';

export function withAuth(handler) {
  return async (request, context) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(request, user, context);
  };
}

export function withAdmin(handler) {
  return withAuth(async (request, user, context) => {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(request, user, context);
  });
}

export function jsonOk(data) {
  return NextResponse.json(data);
}

export function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
