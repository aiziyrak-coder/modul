const GroupModel = require("#references/group/group.model");

const checkGroupDirection = async ({ groupId, directionId }) => {
  if (!groupId || !directionId) return null;

  const group = await GroupModel.findById(groupId).select("title direction").lean();
  if (!group) return null;
  if (!group.direction) return null;

  if (String(group.direction) !== String(directionId)) {
    return {
      message:
        `"${group.title}" guruhi tanlangan yo'nalishga tegishli emas. ` +
        `Guruh yoki yo'nalishni tekshiring.`,
    };
  }
  return null;
};

module.exports = { checkGroupDirection };
