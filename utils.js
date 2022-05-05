module.exports.updateOrCreate = async(model, where, item) => {
    const found = await model.findOne({where})
    if (!found) {
        const newItem = await model.create(item)
        return {created: true}
    }

    const updateItem = await model.update(item, {where})
    return {created: false}
}