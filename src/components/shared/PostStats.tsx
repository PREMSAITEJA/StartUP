import { Models } from "appwrite";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import { checkIsLiked } from "@/lib/utils";
import {
  useLikePost,
  useSavePost,
  useDeleteSavedPost,
  useGetCurrentUser,
} from "@/lib/react-query/queries";

type PostStatsProps = {
  post: Models.Document;
  userId: string;
};

const PostStats = ({ post, userId }: PostStatsProps) => {
  const location = useLocation();
  const likesList = useMemo(() => post.likes.map((user: Models.Document) => user.$id), [post.likes]);

  const [likes, setLikes] = useState<string[]>(likesList);
  const [isSaved, setIsSaved] = useState(false);

  const { mutate: likePost } = useLikePost();
  const { mutate: savePost } = useSavePost();
  const { mutate: deleteSavePost } = useDeleteSavedPost();

  const { data: currentUser } = useGetCurrentUser();

  const savedPostRecord = useMemo(() => {
    return currentUser?.save?.find(
      (record: Models.Document) => record.post?.$id === post.$id
    );
  }, [currentUser, post.id]);

  useEffect(() => {
    setIsSaved(!!savedPostRecord);
  }, [savedPostRecord]);

  const handleLikePost = (
    e: React.MouseEvent<HTMLImageElement, MouseEvent>
  ) => {
    e.stopPropagation();

    const updatedLikes = likes.includes(userId)
      ? likes.filter((id) => id !== userId)
      : [...likes, userId];

    setLikes(updatedLikes);
    likePost({ postId: post.$id, likesArray: updatedLikes });
  };

  const handleSavePost = (
    e: React.MouseEvent<HTMLImageElement, MouseEvent>
  ) => {
    e.stopPropagation();

    if (savedPostRecord) {
      setIsSaved(false);
      deleteSavePost(savedPostRecord.$id);
    } else {
      savePost({ userId: userId, postId: post.$id });
      setIsSaved(true);
    }
  };

  const containerStyles = useMemo(() => location.pathname.startsWith("/profile") ? "w-full" : "", [location.pathname]);

  return (
    <div className={`flex justify-between items-center z-20 ${containerStyles}`}>
      <div className="flex gap-2 mr-5">
        <img
          src={`${
            checkIsLiked(likes, userId)
              ? "/assets/icons/liked.svg"
              : "/assets/icons/like.svg"
          }`}
          alt="like"
          width={20}
          height={20}
          onClick={handleLikePost}
          className="cursor-pointer"
        />
        <p className="small-medium lg:base-medium">{likes.length}</p>
      </div>

      <div className="flex gap-2">
        <img
          src={isSaved ? "/assets/icons/saved.svg" : "/assets/icons/save.svg"}
          alt="share"
          width={20}
          height={20}
          className="cursor-pointer"
          onClick={handleSavePost}
        />
      </div>
    </div>
  );
};

export default PostStats;
