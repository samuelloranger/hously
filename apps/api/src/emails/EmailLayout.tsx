import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
} from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';
import type { ReactNode } from 'react';

interface EmailLayoutProps {
  heading: string;
  preview: string;
  children: ReactNode;
}

export function EmailLayout({ heading, preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="m-0 bg-gray-100 p-0 font-sans">
          <Container className="mx-auto my-10 max-w-[560px] overflow-hidden rounded-xl bg-white shadow-sm">
            <Section className="bg-indigo-600 px-8 py-6">
              <Text className="m-0 text-[22px] font-bold text-white">
                {heading}
              </Text>
            </Section>
            <Section className="px-8 py-8">{children}</Section>
            <Section className="border-t border-gray-200 bg-gray-50 px-8 py-4">
              <Text className="m-0 text-center text-xs text-gray-400">
                Hously
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
