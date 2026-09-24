export default defineStore(
  "user",
  () => {
    const token = localStorage.getItem("token");
    return { token };
  },
  { persist: true },
);
