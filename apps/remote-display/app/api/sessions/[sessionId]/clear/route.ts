import {NextRequest, NextResponse} from "next/server";
import {clearContent, getSession} from "@/lib/sessions";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function POST(_req: NextRequest, {params}: RouteParams) {
    const {sessionId} = await params;
    const session = await getSession(sessionId);

    if (!session) {
        return NextResponse.json({error: "Session not found"}, {status: 404});
    }

    await clearContent(session);
    return NextResponse.json({success: true});
}