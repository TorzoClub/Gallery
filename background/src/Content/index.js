import React from 'react';
import {  Menu } from 'element-react'

import './Content.css'

import MemberManage from './MemberManage';
import GalleryManage from './GalleryManage';


class Content extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            selectedItem:'gallery'
        }

        this.onMenuSelect = this.onMenuSelect.bind(this);
    }

    onMenuSelect(index){
        this.setState({selectedItem:index})
    }

    render() {
        return (
            <div className="Content-holder">
                <div className="Side-nav">
                    <Menu defaultActive="gallery"  mode="horizontal" className="El-menu-vertical" onSelect={this.onMenuSelect}>
                        <Menu.Item index="gallery">相册管理</Menu.Item>
                        <Menu.Item index="member">成员管理</Menu.Item>
                    </Menu>
                   <Selector itemName={this.state.selectedItem}/>
                </div>
            </div>
        )
    }
}

const Selector = props =>{
    switch (props.itemName){
        case 'gallery':
            return <GalleryManage />;
        case 'member':
            return <MemberManage />;
        default:
            return 'any'
    }
}

export default Content;  