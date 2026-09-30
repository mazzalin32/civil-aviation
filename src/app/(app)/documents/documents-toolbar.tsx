"use client";

import { useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UploadDocumentDialog } from "./upload-document-dialog";

export function DocumentsToolbar({
  query,
  sort,
  matters,
  folders,
}: {
  query?: string;
  sort: "latest" | "az";
  matters: { id: string; reference: string; title: string }[];
  folders: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="primary" onClick={() => setUploadOpen(true)}>
          <Plus className="size-4" /> Upload document
        </Button>
        <Card className="min-w-[260px] flex-1 p-1.5">
          <form ref={formRef} className="flex items-center gap-2">
            <Input name="q" icon={Search} defaultValue={query ?? ""} placeholder="Search by document name, case title or reference…" className="border-0 shadow-none" />
            <Select
              name="sort"
              defaultValue={sort}
              onChange={() => formRef.current?.requestSubmit()}
              className="w-auto min-w-[140px] shrink-0 border-0"
            >
              <option value="latest">Latest first</option>
              <option value="az">Name A–Z</option>
            </Select>
          </form>
        </Card>
      </div>

      <UploadDocumentDialog matters={matters} folders={folders} open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
