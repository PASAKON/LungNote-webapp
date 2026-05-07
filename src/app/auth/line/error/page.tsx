import Link from "next/link";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  missing_token: "ไม่พบโทเคน — โปรดเปิดลิงก์จาก LINE OA อีกครั้ง",
  invalid_or_expired:
    "ลิงก์หมดอายุหรือถูกใช้ไปแล้ว — กลับไปที่ LINE OA แล้วพิมพ์ 'dashboard' เพื่อรับลิงก์ใหม่",
  create_user_failed: "สร้างบัญชีไม่สำเร็จ — ลองอีกครั้งภายหลัง",
  magic_link_failed: "สร้าง session ไม่สำเร็จ — ลองอีกครั้งภายหลัง",
};

export default async function AuthLineErrorPage({
  searchParams,
}: PageProps<"/auth/line/error">) {
  const params = await searchParams;
  const codeRaw = params.code;
  const code = Array.isArray(codeRaw) ? codeRaw[0] : codeRaw;
  const message = (code && MESSAGES[code]) ?? "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16 text-center">
      <div className="flex max-w-md flex-col items-center gap-6">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-2xl font-semibold">เปิด Dashboard ไม่ได้</h1>
        <p className="text-zinc-600 dark:text-zinc-400">{message}</p>
        <Link
          href="/"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    </main>
  );
}
