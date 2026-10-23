"use client";

export function AILoadingMessage() {
  return (
    <div className="flex justify-start my-2.5">
      <div className="max-w-[85%] rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 shadow-none">
        <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
          AI Assistant sedang mengetik...
        </p>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="size-2 animate-bounce rounded-none bg-indigo-600 dark:bg-indigo-400 [animation-delay:-0.2s]" />
          <span className="size-2 animate-bounce rounded-none bg-indigo-600 dark:bg-indigo-400 [animation-delay:-0.1s]" />
          <span className="size-2 animate-bounce rounded-none bg-indigo-600 dark:bg-indigo-400" />
        </div>
      </div>
    </div>
  );
}
