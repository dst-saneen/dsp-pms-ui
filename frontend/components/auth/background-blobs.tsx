/** Shared ambient background for login / register / verify marketing pages. */
export function BackgroundBlobs() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#FBF8F5]"
      aria-hidden="true"
    >
      <div className="absolute -top-[18%] -left-[12%] h-[42%] w-[44%] rounded-[48%_52%_44%_56%/52%_42%_58%_48%] bg-[#F8D4C6] opacity-20 blur-3xl md:h-[50%] md:opacity-30 lg:h-[55%] lg:w-[48%] lg:opacity-45" />
      <div className="absolute top-[10%] left-[22%] hidden h-[40%] w-[34%] rounded-[42%_58%_62%_38%/48%_42%_58%_52%] bg-[#EAF3EE] opacity-30 blur-3xl md:block lg:opacity-50" />
      <div className="absolute -bottom-[22%] -left-[10%] h-[40%] w-[38%] rounded-[46%_54%_42%_58%/50%_46%_54%_50%] bg-[#E4F0EA] opacity-20 blur-3xl md:h-[46%] md:opacity-30 lg:h-[50%] lg:w-[42%] lg:opacity-45" />
      <div className="absolute top-[28%] left-[38%] hidden h-[36%] w-[28%] rounded-[50%] bg-[#F6DCCF] opacity-40 blur-3xl lg:block" />
      <div className="absolute -right-[8%] -bottom-[24%] h-[44%] w-[40%] rounded-[52%_40%_58%_44%/44%_56%_42%_58%] bg-[#F6D2C4] opacity-20 blur-3xl md:h-[52%] md:opacity-30 lg:h-[58%] lg:w-[42%] lg:opacity-50" />
    </div>
  );
}
