import React from 'react';
import { createAvatar } from '@dicebear/core';
import { micah } from '@dicebear/collection';

const BigHeadAvatar = ({
  name,
  avatarSeed, // New prop for custom avatar seed
  size = 100,
  style = {},
  ...props
}) => {
  // Use custom avatarSeed if provided, otherwise fall back to name
  const seed = avatarSeed || name || 'User';

  // Create DiceBear avatar
  const avatar = createAvatar(micah, {
    seed: seed,
    size: size,
  });

  const svgString = avatar.toString();

  return (
    <div style={{
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      overflow: 'hidden',
      ...style
    }} {...props}>
      <div
        dangerouslySetInnerHTML={{ __html: svgString }}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      />
    </div>
  );
};

export default BigHeadAvatar;
