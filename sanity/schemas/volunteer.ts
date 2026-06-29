export default {
  name: "volunteer",
  title: "Volunteer",
  type: "document",
  fields: [
    { name: "firstName", title: "First Name", type: "string" },
    { name: "lastName", title: "Last Name", type: "string" },
    { name: "email", title: "Email", type: "string" },
    { name: "phoneNumber", title: "Phone Number", type: "string" },
    { name: "country", title: "Country", type: "string" },
    { name: "city", title: "City", type: "string" },
    { name: "languages", title: "Languages", type: "array", of: [{ type: "string" }] },
    { name: "skills", title: "Skills", type: "array", of: [{ type: "string" }] },
    { name: "notes", title: "Notes", type: "text" },
    { name: "active", title: "Active", type: "boolean", initialValue: true },
    { name: "createdAt", title: "Created At", type: "datetime", readOnly: true }
  ]
};
