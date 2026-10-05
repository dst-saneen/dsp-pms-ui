"use client";

import { FormHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface Props
  extends FormHTMLAttributes<HTMLFormElement> {

  children: React.ReactNode;

}

export function Form({

  className,

  children,

  ...props

}: Props) {

  return (

    <form
      className={cn(
        "space-y-6",
        className,
      )}
      {...props}
    >

      {children}

    </form>

  );

}