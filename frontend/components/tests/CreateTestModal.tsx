"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTestSchema, type CreateTestFormValues } from "@/lib/validation";
import { useTestStore } from "@/store/test-store";
import type { z } from "zod";

const defaults: CreateTestFormValues = {
  name: "",
  description: "",
  scriptType: "HTTP",
  targetUrl: "",
  virtualUsers: 100,
};

export function CreateTestModal() {
  const [open, setOpen] = useState(false);
  const createTest = useTestStore((state) => state.dispatchCreateTest);
  const form = useForm<z.input<typeof createTestSchema>>({
    resolver: zodResolver(createTestSchema),
    defaultValues: defaults,
  });

  const close = () => {
    form.reset(defaults);
    setOpen(false);
  };

  const onSubmit = (values: z.input<typeof createTestSchema>) => {
    createTest(values as CreateTestFormValues);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}>
      <Button className="fixed right-5 bottom-5 z-30 h-11 rounded-full px-5 shadow-lg shadow-sky-600/20" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" /> New Test
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a load test</DialogTitle>
          <DialogDescription>Set the target and concurrency for a new performance test.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-2"><Label htmlFor="test-name">Test Name</Label><Input id="test-name" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} /><FieldError message={form.formState.errors.name?.message} /></div>
          <div className="grid gap-2"><Label htmlFor="description">Description</Label><textarea id="description" className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-[var(--ring)] focus-visible:ring-3 focus-visible:ring-[color:color-mix(in_srgb,var(--ring)_45%,transparent)]" {...form.register("description")} /><FieldError message={form.formState.errors.description?.message} /></div>
          <div className="grid gap-2"><Label>Script Type</Label><Controller control={form.control} name="scriptType" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger aria-label="Script Type" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="HTTP">HTTP</SelectItem><SelectItem value="TruClient">TruClient</SelectItem><SelectItem value="JMeter">JMeter</SelectItem></SelectContent></Select>} /><FieldError message={form.formState.errors.scriptType?.message} /></div>
          <div className="grid gap-2"><Label htmlFor="target-url">Target URL</Label><Input id="target-url" type="url" placeholder="https://api.example.com/v1/orders" aria-invalid={Boolean(form.formState.errors.targetUrl)} {...form.register("targetUrl")} /><FieldError message={form.formState.errors.targetUrl?.message} /></div>
          <div className="grid gap-2"><Label htmlFor="virtual-users">Virtual Users</Label><Input id="virtual-users" type="number" min="1" max="10000" aria-invalid={Boolean(form.formState.errors.virtualUsers)} {...form.register("virtualUsers")} /><FieldError message={form.formState.errors.virtualUsers?.message} /></div>
          <DialogFooter className="mt-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit">Create Test</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="text-xs text-rose-600">{message}</p> : null;
}
