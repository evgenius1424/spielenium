import {NextRequest, NextResponse} from "next/server";
import {getSession, selectContent} from "@/lib/sessions";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function POST(req: NextRequest, {params}: RouteParams) {
    const {sessionId} = await params;
    const session = await getSession(sessionId);

    if (!session) {
        return NextResponse.json({error: "Session not found"}, {status: 404});
    }

    const {contentId} = await req.json();

    if (!contentId) {
        return NextResponse.json({error: "Content ID is required"}, {status: 400});
    }

    const success = await selectContent(session, contentId);

    if (!success) {
        return NextResponse.json({error: "Content not found"}, {status: 404});
    }

    return NextResponse.json({success: true});
}