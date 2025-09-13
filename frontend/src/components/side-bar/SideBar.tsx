const SideBar = ({
  color,
  changeColor,
}: {
  color: string;
  changeColor: (color: string) => void;
}) => {
  return (
    <div className="fixed z-10 left-5 bottom-5">
      <div className="bg-white flex align-center justify-center p-2 rounded-sm border border-gray-200 shadow-lg">
        <input
          className="w-10 h-10"
          type="color"
          value={color}
          onChange={(e) => {
            changeColor(e.target.value);
          }}
        />
      </div>
    </div>
  );
};

export default SideBar;
