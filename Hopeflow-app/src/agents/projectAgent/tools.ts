import ResTool from "@/socket/resTool";
import { createPresentChoicesTool } from "@/utils/agent/presentChoices";

interface ToolConfig {
  resTool: ResTool;
  msg: ReturnType<ResTool["newMessage"]>;
}

/**
 * 项目创建 Agent 工具集：将选择项以可点击按钮形式呈现给用户
 */
export default ({ msg }: ToolConfig) => {
  return {
    present_choices: createPresentChoicesTool({ msg }),
  };
};
