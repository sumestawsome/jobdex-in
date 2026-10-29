import { redirect } from "next/navigation";

export default async function JobdeskRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const queryString = new URLSearchParams(
    Object.entries(resolvedParams || {}).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((v) => [key, v]) : value ? [[key, value]] : []
    )
  ).toString();

  redirect(queryString ? `/dashboard/tasks?${queryString}` : "/dashboard/tasks");
}

