'use strict';

var React = require('react');
var ReactTransitionChildMapping = require('./ReactTransitionChildMapping');
var CSSTransitionGroupChild = require('./CSSTransitionGroupChild');

var CSSTransitionGroup = React.createClass({
  protoTypes: {
    component: React.PropTypes.any,
    transitionName: React.PropTypes.string.isRequired,
    transitionEnter: React.PropTypes.bool,
    transitionLeave: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      component: 'span',
      transitionEnter: true,
      transitionLeave: true
    };
  },

  getInitialState() {
    var ret = [];
    React.Children.forEach(this.props.children, (c)=> {
      ret.push(c);
    });
    return {
      children: ret
    };
  },

  componentWillMount() {
    this.currentlyTransitioningKeys = {};
    this.keysToEnter = [];
    this.keysToLeave = [];
    this._refs = {};
  },

  componentWillReceiveProps(nextProps) {
    var nextChildMapping = [];
    var showProp = this.props.showProp;
    var exclusive = this.props.exclusive;

    React.Children.forEach(nextProps.children, (c)=> {
      nextChildMapping.push(c);
    });

    var prevChildMapping
    // last props children if exclusive
    if (exclusive) {
      prevChildMapping = [];
      React.Children.forEach(this.props.children, (c)=> {
        prevChildMapping.push(c);
      });
    } else {
      prevChildMapping = this.state.children;
    }

    var newChildren = ReactTransitionChildMapping.mergeChildMappings(
      prevChildMapping,
      nextChildMapping
    );

    if (showProp) {
      newChildren = newChildren.map((c)=> {
        if (!c.props[showProp] && ReactTransitionChildMapping.isShownInChildren(prevChildMapping, c, showProp)) {
          var newProps = {};
          newProps[showProp] = true;
          c = React.cloneElement(c, newProps);
        }
        return c;
      });
    }

    if (exclusive) {
      // make middle state children invalid
      // restore to last props children
      newChildren.forEach((c)=> {
        this.stop(c.key);
      });
    }

    this.setState({
      children: newChildren
    });

    nextChildMapping.forEach((c)=> {
      var key = c.key;
      var hasPrev = prevChildMapping && ReactTransitionChildMapping.inChildren(prevChildMapping, c);
      if (showProp) {
        if (hasPrev) {
          var showInPrev = ReactTransitionChildMapping.isShownInChildren(prevChildMapping, c, showProp);
          var showInNow = c.props[showProp];
          if (!showInPrev && showInNow && !this.currentlyTransitioningKeys[key]) {
            this.keysToEnter.push(key);
          }
        }
      } else if (!hasPrev && !this.currentlyTransitioningKeys[key]) {
        this.keysToEnter.push(key);
      }
    });

    prevChildMapping.forEach((c)=> {
      var key = c.key;
      var hasNext = nextChildMapping && ReactTransitionChildMapping.inChildren(nextChildMapping, c);
      if (showProp) {
        if (hasNext) {
          var showInNext = ReactTransitionChildMapping.isShownInChildren(nextChildMapping, c, showProp);
          var showInNow = c.props[showProp];
          if (!showInNext && showInNow && !this.currentlyTransitioningKeys[key]) {
            this.keysToLeave.push(key);
          }
        }
      } else if (!hasNext && !this.currentlyTransitioningKeys[key]) {
        this.keysToLeave.push(key);
      }
    });
  },

  performEnter(key) {
    this.currentlyTransitioningKeys[key] = true;
    var component = this._refs[key];
    if (component.componentWillEnter) {
      component.componentWillEnter(
        this._handleDoneEntering.bind(this, key)
      );
    } else {
      this._handleDoneEntering(key);
    }
  },

  _handleDoneEntering(key) {
    //console.log('_handleDoneEntering, ', key);
    delete this.currentlyTransitioningKeys[key];
    var currentChildMapping = [];
    React.Children.forEach(this.props.children, (c)=> {
      currentChildMapping.push(c);
    });
    var showProp = this.props.showProp;
    if (!currentChildMapping || (
      !showProp && !ReactTransitionChildMapping.inChildrenByKey(currentChildMapping, key)
      ) || (
      showProp && !ReactTransitionChildMapping.isShownInChildrenByKey(currentChildMapping, key, showProp)
      )) {
      // This was removed before it had fully entered. Remove it.
      //console.log('releave ',key);
      this.performLeave(key);
    } else {
      this.setState({children: currentChildMapping});
    }
  },

  stop(key) {
    delete this.currentlyTransitioningKeys[key];
    var component = this._refs[key];
    if (component) {
      component.stop();
    }
  },

  performLeave(key) {
    this.currentlyTransitioningKeys[key] = true;

    var component = this._refs[key];
    if (component.componentWillLeave) {
      component.componentWillLeave(this._handleDoneLeaving.bind(this, key));
    } else {
      // Note that this is somewhat dangerous b/c it calls setState()
      // again, effectively mutating the component before all the work
      // is done.
      this._handleDoneLeaving(key);
    }
  },

  _handleDoneLeaving(key) {
    //console.log('_handleDoneLeaving, ', key);
    delete this.currentlyTransitioningKeys[key];
    var showProp = this.props.showProp;
    var currentChildMapping = [];
    React.Children.forEach(this.props.children, (c)=> {
      currentChildMapping.push(c);
    });
    if (showProp && currentChildMapping &&
      ReactTransitionChildMapping.isShownInChildrenByKey(currentChildMapping, key, showProp)) {
      this.performEnter(key);
    } else if (!showProp && currentChildMapping && ReactTransitionChildMapping.inChildrenByKey(currentChildMapping, key)) {
      // This entered again before it fully left. Add it again.
      //console.log('reenter ',key);
      this.performEnter(key);
    } else {
      this.setState({children: currentChildMapping});
    }
  },

  componentDidUpdate() {
    var keysToEnter = this.keysToEnter;
    this.keysToEnter = [];
    keysToEnter.forEach(this.performEnter);
    var keysToLeave = this.keysToLeave;
    this.keysToLeave = [];
    keysToLeave.forEach(this.performLeave);
  },

  render() {
    var _this = this;
    var props = this.props;
    var children = this.state.children.map((child) => {
      return <CSSTransitionGroupChild
        key={child.key}
        ref={function(c) { _this._refs[child.key] = c; }}
        name={props.transitionName}
        enter={props.transitionEnter}
        leave={props.transitionLeave}>{child}</CSSTransitionGroupChild>;
    });
    var Component = this.props.component;
    return <Component {...this.props}>{children}</Component>;
  }
});
module.exports = CSSTransitionGroup;
