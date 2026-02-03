import { ReactNode } from "react";

interface ConditionalWrapperProps {
  condition: boolean;
  wrapper: (children: ReactNode) => ReactNode;
  elseWrapper?: (children: ReactNode) => ReactNode;
  children: ReactNode;
}

export const ConditionalWrapper = ({
  condition,
  wrapper,
  elseWrapper,
  children,
}: ConditionalWrapperProps) => {
  if (condition) {
    return <>{wrapper(children)}</>;
  }

  if (elseWrapper) {
    return <>{elseWrapper(children)}</>;
  }

  return <>{children}</>;
};
