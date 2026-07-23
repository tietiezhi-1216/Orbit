import type { ReactNode, Ref } from "react";
import { ProductMascotMotion } from "@/components/product-mascot-motion";
import { ProductMotionStage } from "@/components/product-motion-stage";

interface ChannelSetupMascotProps {
  children?: ReactNode;
  className?: string;
  mascotClassName?: string;
  mascotRef?: Ref<HTMLSpanElement>;
  motionPaused?: boolean;
}

export function ChannelSetupMascot({
  children,
  className,
  mascotClassName,
  mascotRef,
  motionPaused = false,
}: ChannelSetupMascotProps) {
  return (
    <ProductMotionStage
      variant="workspace"
      className={className}
      mascotClassName={mascotClassName}
      mascotRef={mascotRef}
      motionPaused={motionPaused}
    >
      {children ?? (
        <ProductMascotMotion
          src="/mode-mascots/paper-plane/code.png"
          blinkSrc="/mode-mascots/paper-plane/code-blink.png"
          variant="workspace"
          intensity="stage"
          paused={motionPaused}
          className="pointer-events-none absolute inset-0 size-full"
        />
      )}
    </ProductMotionStage>
  );
}
