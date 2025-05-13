import { ID, Query, Client, Account, Databases, Storage, Avatars } from "appwrite"; // Ensure all necessary Appwrite modules are imported

import { appwriteConfig } from "./config"; // Assuming appwriteConfig is correctly imported
import { IUpdatePost, INewPost, INewUser, IUpdateUser } from "@/types";

// Initialize Appwrite services (make sure this is done correctly, perhaps in config.ts)
// If you have these initialized in config.ts, you don't need to re-initialize here,
// just make sure they are exported and imported correctly.
// Assuming the imports from "./config" already provide initialized instances:
const account = new Account(new Client().setEndpoint(appwriteConfig.url).setProject(appwriteConfig.projectId));
const databases = new Databases(new Client().setEndpoint(appwriteConfig.url).setProject(appwriteConfig.projectId));
const storage = new Storage(new Client().setEndpoint(appwriteConfig.url).setProject(appwriteConfig.projectId));
const avatars = new Avatars(new Client().setEndpoint(appwriteConfig.url).setProject(appwriteConfig.projectId));


// ============================================================
// AUTH
// ============================================================

// ============================== SIGN UP
export async function createUserAccount(user: INewUser) {
  try {
    const newAccount = await account.create(
      ID.unique(),
      user.email,
      user.password,
      user.name
    );

    if (!newAccount) throw Error;

    const avatarUrl = avatars.getInitials(user.name);

    // Note: saveUserToDB expects imageUrl as URL type in its definition,
    // but avatars.getInitials returns a string. You might need to adjust
    // the type definition for saveUserToDB or handle this type mismatch.
    const newUser = await saveUserToDB({
      accountId: newAccount.$id,
      name: newAccount.name,
      email: newAccount.email,
      username: user.username,
      imageUrl: avatarUrl as unknown as URL, // Cast if avatars returns string and saveUserToDB expects URL object
    });

    return newUser;
  } catch (error) {
    console.log(error);
    return error;
  }
}

// ============================== SAVE USER TO DB
// Consider if imageUrl should be string here if avatars.getInitials returns string
export async function saveUserToDB(user: {
  accountId: string;
  email: string;
  name: string;
  imageUrl: string; // Changed type to string based on avatars.getInitials likely returning string
  username?: string;
}) {
  try {
    const newUser = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      user
    );

    return newUser;
  } catch (error) {
    console.log(error);
  }
}

// ============================== SIGN IN
export async function signInAccount(user: { email: string; password: string }) {
  try {
    const session = await account.createEmailSession(user.email, user.password);

    return session;
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET ACCOUNT
export async function getAccount() {
  try {
    const currentAccount = await account.get();

    return currentAccount;
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET USER
export async function getCurrentUser() {
  try {
    const currentAccount = await getAccount();

    if (!currentAccount) throw Error;

    const currentUser = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal("accountId", currentAccount.$id)]
    );

    if (!currentUser) throw Error;

    return currentUser.documents[0];
  } catch (error) {
    console.log(error);
    return null;
  }
}

// ============================== SIGN OUT
export async function signOutAccount() {
  try {
    const session = await account.deleteSession("current");

    return session;
  } catch (error) {
    console.log(error);
  }
}

// ============================================================
// POSTS
// ============================================================

// ============================== CREATE POST
export async function createPost(post: INewPost) {
  try {
    // Upload file to appwrite storage
    const uploadedFile = await uploadFile(post.file[0]);

    if (!uploadedFile) throw Error;

    // Get file url (now returns string)
    const fileUrl = getFilePreview(uploadedFile.$id);
    if (!fileUrl) {
      await deleteFile(uploadedFile.$id);
      throw Error;
    }

    // Convert tags into array
    const tags = post.tags?.replace(/ /g, "").split(",") || [];

    // Create post
    const newPost = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      ID.unique(),
      {
        creator: post.userId,
        caption: post.caption,
        imageUrl: fileUrl, // Now storing the correct URL string
        imageId: uploadedFile.$id,
        location: post.location,
        tags: tags,
      }
    );

    if (!newPost) {
      await deleteFile(uploadedFile.$id);
      throw Error;
    }

    return newPost;
  } catch (error) {
    console.log(error);
  }
}

// ============================== UPLOAD FILE
export async function uploadFile(file: File) {
  try {
    const uploadedFile = await storage.createFile(
      appwriteConfig.storageId,
      ID.unique(),
      file
    );

    return uploadedFile;
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET FILE URL
export function getFilePreview(fileId: string) {
  try {
    const fileUrl = storage.getFilePreview(
      appwriteConfig.storageId,
      fileId,
      2000, // Optional: Adjust width
      2000, // Optional: Adjust height
      "top", // Optional: Adjust crop mode
      100   // Optional: Adjust quality
    );

    if (!fileUrl) {
        // Handle the case where getFilePreview might return null or undefined
        console.error("getFilePreview returned null for fileId:", fileId);
        return null;
    }

    // **THIS IS THE CRUCIAL MODIFICATION:** Return the URL string using .href
    return fileUrl.href;

  } catch (error) {
    console.error("Error getting file preview for fileId:", fileId, error);
    // Return null on error
    return null;
  }
}

// ============================== DELETE FILE
export async function deleteFile(fileId: string) {
  try {
    await storage.deleteFile(appwriteConfig.storageId, fileId);

    return { status: "ok" };
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET POSTS
export async function searchPosts(searchTerm: string) {
  try {
    const posts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      [Query.search("caption", searchTerm)]
    );

    if (!posts) throw Error;

    return posts;
  } catch (error) {
    console.log(error);
  }
}

export async function getInfinitePosts({ pageParam }: { pageParam: number }) {
  const queries: any[] = [Query.orderDesc("$updatedAt"), Query.limit(9)];

  if (pageParam) {
    queries.push(Query.cursorAfter(pageParam.toString()));
  }

  try {
    const posts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      queries
    );

    if (!posts) throw Error;

    return posts;
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET POST BY ID
export async function getPostById(postId?: string) {
  if (!postId) {
    throw new Error("Post ID is required");
  }

  try {
    const post = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId
    );

    if (!post) {
      throw new Error(`No post found with ID: ${postId}`);
    }

    return post;
  } catch (error) {
    console.error("Error while fetching post:", error);
    throw error; // Re-throw the error for better debugging
  }
}

// ============================== UPDATE POST
export async function updatePost(post: IUpdatePost) {
  const hasFileToUpdate = post.file && post.file.length > 0; // Safeguard file check

  try {
    let image = {
      imageUrl: post.imageUrl || "",
      imageId: post.imageId || "",
    };

    if (hasFileToUpdate) {
      // Upload new file to appwrite storage
      const uploadedFile = await uploadFile(post.file[0]);
      if (!uploadedFile) {
        throw new Error("Failed to upload file");
      }

      // Get new file url (now returns string)
      const fileUrl = getFilePreview(uploadedFile.$id);
      if (!fileUrl) {
        await deleteFile(uploadedFile.$id);
        throw new Error("Failed to generate file preview");
      }

      image = { ...image, imageUrl: fileUrl, imageId: uploadedFile.$id };
    }

    const tags = post.tags?.replace(/ /g, "").split(",") || [];

    const updatedPost = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      post.postId,
      {
        caption: post.caption || "No caption",
        imageUrl: image.imageUrl, // Now storing the correct URL string
        imageId: image.imageId,
        location: post.location || "Unknown location",
        tags: tags,
      }
    );

    if (!updatedPost) {
      if (hasFileToUpdate) {
        await deleteFile(image.imageId);
      }
      throw new Error("Failed to update post");
    }

    // Safely delete old file after successful update if a new file was uploaded
    if (post.imageId && hasFileToUpdate) {
        await deleteFile(post.imageId);
    }


    return updatedPost;
  } catch (error) {
    console.error("Error while updating post:", error);
    throw error; // Re-throw the error for better debugging
  }
}

// ============================== DELETE POST
export async function deletePost(postId?: string, imageId?: string) {
  if (!postId) {
    throw new Error("Post ID is required to delete");
  }

  if (!imageId) {
    console.warn("Image ID not provided, only deleting the post document.");
  }

  try {
    // Delete the post document
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId
    );

    // If an imageId was provided, attempt to delete the file from storage
    if (imageId) {
      try {
        await deleteFile(imageId);
        console.log(`Successfully deleted file with ID: ${imageId}`);
      } catch (deleteFileError) {
        // Log a warning if file deletion fails, but don't block post deletion
        console.warn(`Failed to delete associated image file ${imageId}:`, deleteFileError);
      }
    }

    return { status: "Ok" }; // Indicate success for document deletion

  } catch (error) {
    console.error("Error while deleting post document with ID:", postId, error);
    throw error; // Re-throw the error if document deletion failed
  }
}


// ============================== LIKE / UNLIKE POST
export async function likePost(postId: string, likesArray: string[]) {
  try {
    const updatedPost = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      postId,
      {
        likes: likesArray,
      }
    );

    if (!updatedPost) throw Error;

    return updatedPost;
  } catch (error) {
    console.log(error);
  }
}

// ============================== SAVE POST
export async function savePost(userId: string, postId: string) {
  try {
    const updatedPost = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.savesCollectionId,
      ID.unique(),
      {
        user: userId,
        post: postId,
      }
    );

    if (!updatedPost) throw Error;

    return updatedPost;
  } catch (error) {
    console.log(error);
  }
}
// ============================== DELETE SAVED POST
export async function deleteSavedPost(savedRecordId: string) {
  try {
    const statusCode = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.savesCollectionId,
      savedRecordId
    );

    if (!statusCode) throw Error;

    return { status: "Ok" };
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET USER'S POST
export async function getUserPosts(userId?: string) {
  if (!userId) return;

  try {
    const post = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      [Query.equal("creator", userId), Query.orderDesc("$createdAt")]
    );

    if (!post) throw Error;

    return post;
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET POPULAR POSTS (BY HIGHEST LIKE COUNT)
export async function getRecentPosts() {
  try {
    const posts = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.postCollectionId,
      [Query.orderDesc("$createdAt"), Query.limit(20)]
    );

    if (!posts) throw Error;

    return posts;
  } catch (error) {
    console.log(error);
  }
}

// ============================================================
// USER
// ============================================================

// ============================== GET USERS
export async function getUsers(limit?: number) {
  const queries: any[] = [Query.orderDesc("$createdAt")];

  if (limit) {
    queries.push(Query.limit(limit));
  }

  try {
    const users = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      queries
    );

    if (!users) throw Error;

    return users;
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET USER BY ID
export async function getUserById(userId: string) {
  try {
    const user = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId
    );

    if (!user) throw Error;

    return user;
  } catch (error) {
    console.log(error);
  }
}

// ============================== UPDATE USER
export async function updateUser(user: IUpdateUser) {
  const hasFileToUpdate = user.file && user.file.length > 0;
  try {
    let image = {
      imageUrl: user.imageUrl,
      imageId: user.imageId,
    };

    if (hasFileToUpdate) {
      // Upload new file to appwrite storage
      const uploadedFile = await uploadFile(user.file[0]);
      if (!uploadedFile) throw Error;

      // Get new file url (now returns string)
      const fileUrl = getFilePreview(uploadedFile.$id);
      if (!fileUrl) {
        await deleteFile(uploadedFile.$id);
        throw Error;
      }

      image = { ...image, imageUrl: fileUrl, imageId: uploadedFile.$id };
    }

    //  Update user
    const updatedUser = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      user.userId,
      {
        name: user.name,
        bio: user.bio,
        imageUrl: image.imageUrl, // Now storing the correct URL string
        imageId: image.imageId,
      }
    );

    // Failed to update
    if (!updatedUser) {
      // Delete new file that has been recently uploaded
      if (hasFileToUpdate) {
        await deleteFile(image.imageId);
      }
      // If no new file uploaded, just throw error
      throw Error;
    }

    // Safely delete old file after successful update if a new file was uploaded
    if (user.imageId && hasFileToUpdate) {
        await deleteFile(user.imageId);
    }

    return updatedUser;
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET FOLLOWERS COUNT
export async function getFollowersCount(userId: string) {
  try {
    const followers = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.followersCollectionId || '',
      [Query.equal("followingId", userId)]
    );

    if (!followers) throw Error;

    return followers.total;
  } catch (error) {
    console.log(error);
  }
}

// ============================== GET FOLLOWING COUNT
export async function getFollowingCount(userId: string) {
  try {
    const following = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.followersCollectionId!,
      [Query.equal("followerId", userId)]
    );

    if (!following) throw Error;

    return following.total;
  } catch (error) {
    console.log(error);
  }
}

// ============================== FOLLOW USER
export async function followUser(followerId: string, followingId: string) {
  try {
    const newFollower = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.followersCollectionId,
      ID.unique(),
      {
        followerId,
        followingId,
      }
    );

    return newFollower;
  } catch (error) {
    console.log(error);
  }
}

// ============================== UNFOLLOW USER
export async function unfollowUser(followerId: string, followingId: string) {
  try {
    const followers = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.followersCollectionId,
      [
        Query.equal("followerId", followerId),
        Query.equal("followingId", followingId),
      ]
    );

    if (followers.total > 0) {
      const followerDocId = followers.documents[0].$id;
      await databases.deleteDocument(
        appwriteConfig.databaseId,
        appwriteConfig.followersCollectionId,
        followerDocId
      );
    }
  } catch (error) {
    console.log(error);
  }
}
