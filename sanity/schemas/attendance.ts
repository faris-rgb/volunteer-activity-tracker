export default {
  name: "attendance",
  title: "Attendance",
  type: "document",
  fields: [
    { name: "volunteer", title: "Volunteer", type: "reference", to: [{ type: "volunteer" }] },
    { name: "activity", title: "Activity", type: "reference", to: [{ type: "activity" }] },
    { name: "status", title: "Status", type: "string", options: { list: ["present", "absent", "late"], layout: "radio" }, initialValue: "present" },
    { name: "notes", title: "Notes", type: "text" },
    { name: "attendedAt", title: "Attended At", type: "datetime" },
    { name: "createdAt", title: "Created At", type: "datetime", readOnly: true }
  ]
};
