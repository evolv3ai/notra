import { Body, Head, Html, Link, Preview, Tailwind, Text } from "react-email";

import { EmailFooter } from "../components/footer";
import type { WelcomeEmailProps } from "../types/welcome";
import { EMAIL_CONFIG } from "../utils/config";

export const WelcomeEmail = ({ slackInvited = false }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>A quick note from Dominik, the founder of Notra</Preview>
    <Tailwind>
      <Body>
        <Text>Hey,</Text>

        <Text>
          I'm Dominik, the founder of Notra. Thanks for signing up. This email
          was sent automatically, but if you reply it goes straight to my inbox
          and I read every one.
        </Text>

        <Text>
          More and more buyers ask ChatGPT, Claude and Gemini which tool to use
          before they ever visit your website. Notra asks those AI engines the
          questions your buyers ask and shows you whether you show up, who shows
          up instead and what to change to win the answers you're losing.
        </Text>

        <Text>
          The best place to start is your first visibility scan:{" "}
          <Link href={EMAIL_CONFIG.getAppUrl()}>
            {EMAIL_CONFIG.getAppUrl()}
          </Link>
        </Text>

        {slackInvited ? (
          <Text>
            I've also invited you to a shared Slack channel with our team. It's
            usually the fastest way to reach us.
          </Text>
        ) : null}

        <Text>
          If you'd rather talk, you can{" "}
          <Link href="https://usenotra.com/founder-chat">
            book a chat with me
          </Link>
          .
        </Text>

        <Text>
          Cheers,
          <br />
          Dominik
        </Text>

        <EmailFooter />
      </Body>
    </Tailwind>
  </Html>
);
