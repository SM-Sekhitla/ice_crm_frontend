import type { User } from "../../types";
import { can } from "../../lib/permissions";

export function getTourSteps(user: User) {
  return [
    {
      path: "/",
      title: "Your dashboard",
      text: "See your contacts, opportunities, follow-ups, and recent activity in one place.",
    },
    {
      path: "/contacts",
      title: "Make a connection",
      text: "Add or import contacts, keep notes, and link each person to a product.",
    },
    {
      path: "/leads",
      title: "Move opportunities forward",
      text: "Update lead stages and schedule follow-ups as conversations progress.",
    },
    {
      path: "/clients",
      title: "Keep growing relationships",
      text: "Successful leads become clients, with their relationship history retained.",
    },
    {
      path: "/products",
      title: "Know your products",
      text: can(user, "products.manage")
        ? "Add products and assign ownership so your team can organise their outreach."
        : "View the products assigned to you and the relationships connected to each one.",
    },
    {
      path: "/campaigns",
      title: "Reach the right people",
      text: "Build personalised campaigns for consenting contacts. Review your message and sender before sending.",
    },
    ...(can(user, "users.manage")
      ? [
          {
            path: "/users",
            title: "Invite your team",
            text: "Invite colleagues by email, choose their roles, and assign product access.",
          },
        ]
      : []),
    ...(can(user, "email_config.manage")
      ? [
          {
            path: "/email-configurations",
            title: "Set up your senders",
            text: "Add provider-authorised sender identities before sending invitations or campaigns.",
          },
        ]
      : []),
    {
      path: "/profile",
      title: "Make it yours",
      text: "Upload your email signature here. You can change your password under Settings.",
    },
  ];
}
