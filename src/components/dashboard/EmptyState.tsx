import { Link } from "@tanstack/react-router";
import { Button } from "../ui/Button";
import { FileText } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#efe9de] text-[#cc785c]">
        <FileText size={32} />
      </div>
      <h2 className="mb-2 text-xl font-medium text-[#141413]">No forms yet</h2>
      <p className="mb-8 max-w-sm text-[#6c6a64]">
        Create your first form to start collecting responses and payments.
      </p>
      <Link to="/forms/new">
        <Button>Create your first form</Button>
      </Link>
    </div>
  );
}
