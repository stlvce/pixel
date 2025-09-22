const AdminMode = ({ isEdit }: { isEdit: boolean }) => {
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-white px-5 py-2 rounded-lg shadow-xl/10 border-1 border-gray-200 z-2">
      Режим: {isEdit ? "редактирования" : "модерация"}
    </div>
  );
};

export default AdminMode;
