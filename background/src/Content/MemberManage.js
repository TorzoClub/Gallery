import React from 'react';
import { Table, Button } from 'element-react';

class MemberManager extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            data: [],
            columns: [
                {
                    label: "QQ 号",
                    prop: "qq_num"
                },
                {
                    label: "名称",
                    prop: "name"
                },
                {
                    label: "操作",
                    prop: "id",
                    render: (row) => {
                        return (
                            <span>
                                <Button type="text" size="small" onClick={() => { this.onEditClick(row) }}>编辑</Button>
                                <Button type="text" size="small" onClick={() => { this.onDeleteClick(row) }}>删除</Button>
                            </span>
                        )
                    }
                }
            ]
        }

        this.onDeleteClick = this.onDeleteClick.bind(this);
        this.onEditClick = this.onEditClick.bind(this);
    }

    async componentDidMount() {
        const response = await window._AXIOS.get('api/admin/member');
        const data = response.data.map(item => {
            item.created_at = new Date(item.created_at);
            item.updated_at = new Date(item.updated_at);
            return item;
        })
        this.setState({ data });
    }

    onDeleteClick(value) {
        console.log(value);
    }

    onEditClick(value) {
        console.log(value)
    }

    render() {
        return (
            <div>
                <Button type="text" >添加</Button>
                <Table
                    style={{ width: '100%' }}
                    columns={this.state.columns}
                    data={this.state.data.map(item => {
                        item.updated_at = item.updated_at.toLocaleString();
                        item.created_at = item.created_at.toLocaleString();
                        return item
                    })}
                    border={true}
                />
            </div>
        )
    }
}

export default MemberManager