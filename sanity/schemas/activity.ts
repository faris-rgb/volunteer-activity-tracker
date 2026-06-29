export default {
  name: "activity",
  title: "Activity",
  type: "document",
  fields: [
    { name: "title", title: "Title", type: "string" },
    { name: "description", title: "Description", type: "text" },
    { name: "date", title: "Date", type: "datetime" },
    { name: "location", title: "Location", type: "string" },
    { name: "capacity", title: "Capacity", type: "number" },
    { name: "active", title: "Active", type: "boolean", initialValue: true },
    { name: "createdAt", title: "Created At", type: "datetime", readOnly: true }
  ]
};
