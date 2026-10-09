// Schema for volunteer feedback sent from the public /feedback page.
export const feedbackSchema = {
  name: "feedback",
  title: "Volunteer feedback",
  type: "document",
  fields: [
    { name: "name", title: "Name (optional)", type: "string" },
    { name: "about", title: "Project or activity", type: "string" },
    { name: "liked", title: "What was fun", type: "text" },
    { name: "disliked", title: "What was not fun", type: "text" },
    { name: "improve", title: "What could be better", type: "text" },
    {
      name: "hadProblems",
      title: "Were there problems?",
      type: "string",
      options: { list: [{ title: "Yes", value: "yes" }, { title: "No", value: "no" }] },
    },
    { name: "problems", title: "Which problems", type: "text" },
    { name: "handled", title: "Handled", type: "boolean", initialValue: false },
    { name: "createdAt", title: "Received at", type: "datetime", readOnly: true },
  ],
  preview: {
    select: { title: "about", subtitle: "createdAt" },
  },
};
