import { Github } from "lucide-react";
import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex items-center justify-between py-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
          <p>Made with ❤️</p>
          <span className="hidden sm:inline">•</span>
          <p>© 2025 Rahul Datta. All rights reserved.</p>
        </div>
        <Link
          href="https://github.com/radatta/schema-spark"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Github className="h-5 w-5" />
          <span className="text-sm font-medium">GitHub</span>
        </Link>
      </div>
    </footer>
  );
}
